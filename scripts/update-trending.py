#!/usr/bin/env python3
"""
TrendRadar → Dreamlab 热点缓存更新脚本
运行：cd /Users/gd-npc-848/TrendRadar && uv run python /path/to/scripts/update-trending.py

流程：
1. 调 TrendRadar DataFetcher 爬取各平台热榜
2. 按 Dreamlab 分类规则分类
3. 调 Gemini 生成播客视角（angle）
4. 写入 src/data/trending-cache.json
"""

import json
import os
import sys
import re
from datetime import datetime
from pathlib import Path

# TrendRadar 根目录
TR_ROOT = Path('/Users/gd-npc-848/TrendRadar')
# Dreamlab 项目根
DL_ROOT = Path(__file__).parent.parent
CACHE_PATH = DL_ROOT / 'src' / 'data' / 'trending-cache.json'

sys.path.insert(0, str(TR_ROOT))

GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')

# 分类关键词规则（中文）
ZH_CATEGORY_RULES = {
    '科技': ['机器人', 'AI', '人工智能', '芯片', '科技', '手机', '苹果', '华为', '特斯拉', '电动', '算法',
              '大模型', '深度学习', '自动驾驶', '无人机', '低空', '宇树', 'GPU', '英伟达', 'Meta',
              'Anthropic', 'Claude', 'GPT', '编程', '开源', '软件', '硬件'],
    '时事政治': ['内阁', '辞职', '总统', '政府', '外交', '军事', '战争', '谈判', '峰会', '制裁',
               '政策', '法规', '选举', '议会', '国会', '联合国', '北约', '美俄', '美中', '两岸'],
    '娱乐': ['春晚', '电影', '票房', '明星', '综艺', '音乐', '演唱会', '剧', '演员', '导演', '歌手',
             'B站', '抖音', '粉丝', '出道', '爆红', '口碑', '豆瓣', '奥斯卡', '金曲'],
    '财经': ['股市', '股票', '基金', '黄金', '美元', '汇率', '利率', '通胀', 'GDP', '经济', '投资',
             '巴菲特', '华尔街', '加密', '比特币', '上市', 'IPO', '营收', '利润', '并购'],
}

EN_CATEGORY_RULES = {
    'Tech': ['AI', 'robot', 'chip', 'GPU', 'software', 'hardware', 'Apple', 'Google', 'Meta',
             'Nvidia', 'OpenAI', 'Anthropic', 'startup', 'tech', 'ML', 'LLM', 'model', 'code'],
    'Politics': ['election', 'government', 'president', 'congress', 'senate', 'NATO', 'UN',
                 'sanctions', 'diplomacy', 'war', 'military', 'treaty', 'cabinet', 'resign'],
    'Entertainment': ['movie', 'film', 'music', 'award', 'celebrity', 'Netflix', 'Hollywood',
                      'Grammy', 'Oscar', 'box office', 'streaming', 'concert'],
    'Finance': ['stock', 'market', 'gold', 'dollar', 'inflation', 'GDP', 'earnings', 'IPO',
                'crypto', 'Bitcoin', 'Buffett', 'Fed', 'interest rate'],
}


def classify_zh(title: str) -> str:
    title_lower = title
    for cat, keywords in ZH_CATEGORY_RULES.items():
        if any(kw in title_lower for kw in keywords):
            return cat
    return '其他'


def classify_en(title: str) -> str:
    title_lower = title.lower()
    for cat, keywords in EN_CATEGORY_RULES.items():
        if any(kw.lower() in title_lower for kw in keywords):
            return cat
    return 'Other'


def generate_angles_with_gemini(titles_by_category: dict, lang: str) -> dict:
    """用 Gemini 批量生成 angle（播客解说视角）"""
    if not GEMINI_API_KEY:
        print('[WARN] GEMINI_API_KEY not set, using title as angle')
        return {}

    import urllib.request

    # 把所有 title 平铺成一个批量请求
    all_items = []
    for cat, titles in titles_by_category.items():
        for t in titles:
            all_items.append({'cat': cat, 'title': t})

    if not all_items:
        return {}

    titles_text = '\n'.join([f"{i+1}. {item['title']}" for i, item in enumerate(all_items)])

    if lang == 'zh':
        prompt = f"""以下是{len(all_items)}个中文热点话题标题，请为每个话题生成一个简洁的播客解说视角（20字以内，有观点，能吸引人点击）。

{titles_text}

严格返回JSON数组，每个元素只包含 "angle" 字段，顺序与上面一致：
[{{"angle": "视角1"}}, {{"angle": "视角2"}}, ...]"""
    else:
        prompt = f"""Here are {len(all_items)} trending news headlines. For each, write a concise podcast angle (under 15 words, opinionated, compelling).

{titles_text}

Return a JSON array with only "angle" field, in the same order:
[{{"angle": "angle1"}}, {{"angle": "angle2"}}, ...]"""

    payload = json.dumps({
        'contents': [{'parts': [{'text': prompt}]}],
        'generationConfig': {'responseMimeType': 'application/json'},
    }).encode()

    url = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}'
    req = urllib.request.Request(url, data=payload, headers={'Content-Type': 'application/json'})

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
        text = data['candidates'][0]['content']['parts'][0]['text']
        angles = json.loads(text)
        return {i: item.get('angle', '') for i, item in enumerate(angles)}
    except Exception as e:
        print(f'[WARN] Gemini angle generation failed: {e}')
        return {}


def crawl_and_update():
    from trendradar.crawler.fetcher import DataFetcher
    from trendradar.utils.time import get_configured_time

    print(f'[{datetime.now().strftime("%H:%M:%S")}] 开始爬取热点...')

    # 爬取所有平台
    fetcher = DataFetcher(str(TR_ROOT))
    results = fetcher.fetch_all()

    print(f'  爬取完成，共 {sum(len(v) for v in results.values())} 条')

    # 整理数据：平铺成 list of {platform_id, platform_name, title, rank}
    items = []
    platform_labels = {
        'toutiao': '今日头条', 'baidu': '百度热搜', 'weibo': '微博热搜',
        'douyin': '抖音热榜', 'zhihu': '知乎热榜', 'bilibili-hot-search': 'B站热搜',
        'tieba': '贴吧热议', 'thepaper': '澎湃新闻', 'ifeng': '凤凰网',
        'wallstreetcn-hot': '华尔街见闻', 'cls-hot': '财联社',
    }

    for platform_id, news_list in results.items():
        label = platform_labels.get(platform_id, platform_id)
        for i, item in enumerate(news_list[:30]):
            title = item.get('title', '').strip()
            if not title or len(title) < 4:
                continue
            items.append({
                'platform_id': platform_id,
                'source': label,
                'title': title,
                'rank': i + 1,
            })

    # 按中文分类
    zh_by_category: dict[str, list] = {c: [] for c in ['科技', '时事政治', '娱乐', '财经', '其他']}
    for item in items:
        cat = classify_zh(item['title'])
        if len(zh_by_category[cat]) < 8:  # 每类最多8条
            zh_by_category[cat].append(item)

    # 每类取前5
    for cat in zh_by_category:
        zh_by_category[cat] = zh_by_category[cat][:5]

    # 批量生成 angles
    titles_map = {cat: [i['title'] for i in items] for cat, items in zh_by_category.items()}
    angle_map = generate_angles_with_gemini(titles_map, 'zh')

    # 转成最终格式
    today = datetime.now().strftime('%Y-%m-%d')
    angle_idx = 0
    zh_result = {}
    for cat, cat_items in zh_by_category.items():
        zh_result[cat] = []
        for item in cat_items:
            angle = angle_map.get(angle_idx, f'{item["title"]}的深度解读')
            zh_result[cat].append({
                'id': f'zh-{item["platform_id"]}-{item["rank"]}',
                'title': item['title'],
                'angle': angle,
                'source': item['source'],
                'date': today,
                'category': cat,
                'lang': 'zh',
            })
            angle_idx += 1

    # 英文：暂时保留现有数据（TODO: RSS爬取）
    existing_cache = {}
    try:
        existing_cache = json.loads(CACHE_PATH.read_text())
    except Exception:
        pass

    cache = {
        'updated_at': datetime.utcnow().isoformat() + 'Z',
        'zh': zh_result,
        'en': existing_cache.get('en', {}),
    }

    CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False, indent=2))
    print(f'  缓存已写入 {CACHE_PATH}')
    print(f'  中文各分类条数: ' + ' | '.join(f'{k}:{len(v)}' for k, v in zh_result.items()))


if __name__ == '__main__':
    crawl_and_update()
