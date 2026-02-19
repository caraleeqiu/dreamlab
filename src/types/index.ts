export type InfluencerType = 'human' | 'animal' | 'virtual' | 'brand'
export type ChatStyle = 'dominant' | 'supportive' | 'debate'
export type JobType = 'podcast' | 'remix' | 'edu' | 'anime' | 'trending' | 'story' | 'script' | 'link'
export type JobStatus = 'pending' | 'scripting' | 'generating' | 'lipsync' | 'stitching' | 'done' | 'failed'
export type ClipStatus = 'pending' | 'submitted' | 'processing' | 'done' | 'lipsync' | 'failed'

export interface Influencer {
  id: number
  user_id: string | null
  slug: string
  name: string
  is_builtin: boolean
  type: InfluencerType
  tagline: string
  personality: string[]
  domains: string[]
  speaking_style?: string
  catchphrases?: string[]
  chat_style?: ChatStyle
  forbidden?: string
  voice_prompt: string
  frontal_image_url?: string
  // Kling 3.0 Subject Library — populated after createSubject() is called
  kling_element_id?: string
  kling_element_voice_id?: string
  created_at: string
}

export interface Job {
  id: number
  user_id: string
  type: JobType
  status: JobStatus
  language: Language
  title?: string
  platform?: string
  aspect_ratio: string
  duration_s?: number
  influencer_ids: number[]
  script?: ScriptClip[]
  final_video_url?: string
  credit_cost: number
  error_msg?: string
  created_at: string
  updated_at: string
  series_name?: string
  episode_number?: number
  cliffhanger?: string
}

export interface ScriptClip {
  index: number
  speaker: string          // influencer slug
  dialogue: string         // 台词（流程中动态生成）
  shot_description: string // 分镜描述
  duration: number         // 秒
  // 分镜扩展字段
  shot_type?: string        // 景别: '特写' | '近景' | '中景' | '全景' | '俯拍' | '仰拍'
  camera_movement?: string  // 镜头运动: '固定' | '推进' | '拉远' | '摇镜' | '跟拍'
  bgm?: string              // BGM风格: '轻松欢快' | '科技感' | '励志' | '悬疑' 等
  voiceover?: string        // 旁白（与台词不同时填写）
  consistency_anchor?: string // 跨分镜视觉锁定：角色外观+场景+光线的一句话绑定描述
  scene_anchor?: string       // 纯场景环境锚定（不含角色），同一地点所有幕共享
  // ── 多 Provider 路由 ──────────────────────────────────────────────────────
  // 有角色台词 → 'kling'（角色锚定，保证跨批次一致性）
  // 纯场景/动画/B-roll → 'seedance'（Seedance API 可用后启用）
  provider?: 'kling' | 'seedance'
}

export interface Clip {
  id: number
  job_id: number
  clip_index: number
  // Provider-agnostic task tracking
  provider?: 'kling' | 'seedance'
  task_id?: string           // unified field (maps to kling_task_id or seedance_task_id in DB)
  kling_task_id?: string     // legacy / Kling-specific (keep for backward compat)
  status: ClipStatus
  prompt?: string
  first_frame_url?: string
  video_url?: string
  lipsync_url?: string
  error_msg?: string
}

export type Language = 'zh' | 'en'

export interface Profile {
  id: string
  email?: string
  display_name?: string
  credits: number
  language: Language
  created_at: string
}
