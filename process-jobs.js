const { SignJWT } = require('jose');
const { createClient } = require('@supabase/supabase-js');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const supabase = createClient('https://sygylcdxubqgswnzapku.supabase.co', process.env.SUPABASE_SERVICE_ROLE_KEY);

const s3 = new S3Client({
  region: 'auto',
  endpoint: 'https://' + process.env.CF_ACCOUNT_ID + '.r2.cloudflarestorage.com',
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

async function generateJWT() {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ iss: process.env.KLING_ACCESS_KEY })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setExpirationTime(now + 1800)
    .setNotBefore(now - 5)
    .sign(new TextEncoder().encode(process.env.KLING_SECRET_KEY));
}

async function queryTask(taskId) {
  const token = await generateJWT();
  const res = await fetch('https://api-beijing.klingai.com/v1/videos/image2video/' + taskId, {
    headers: { Authorization: 'Bearer ' + token }
  });
  return res.json();
}

async function uploadToR2(key, buffer, contentType) {
  await s3.send(new PutObjectCommand({
    Bucket: 'dreamlab-assets',
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));
  return 'https://pub-d322045dfd244ecf9fa6fcbe9ca506bc.r2.dev/' + key;
}

async function processJob(jobId) {
  console.log('\n=== Processing Job', jobId, '===');
  
  const { data: clips } = await supabase.from('clips')
    .select('id, clip_index, status, kling_task_id, task_id, video_url')
    .eq('job_id', jobId)
    .order('clip_index');
  
  for (const clip of clips || []) {
    const taskId = clip.kling_task_id || clip.task_id;
    if (taskId === null || clip.status === 'done') {
      console.log('Clip', clip.clip_index, ':', clip.status, clip.video_url ? '(has video)' : '');
      continue;
    }
    
    const resp = await queryTask(taskId);
    const status = resp?.data?.task_status;
    const videoUrl = resp?.data?.task_result?.videos?.[0]?.url;
    
    console.log('Clip', clip.clip_index, ':', status);
    
    if (status === 'succeed' && videoUrl && (clip.video_url === null || clip.video_url === undefined)) {
      console.log('  Downloading...');
      const r = await fetch(videoUrl);
      const buf = Buffer.from(await r.arrayBuffer());
      const r2Url = await uploadToR2('clips/' + jobId + '/' + clip.clip_index + '.mp4', buf, 'video/mp4');
      console.log('  Uploaded:', r2Url);
      
      await supabase.from('clips')
        .update({ status: 'done', video_url: r2Url })
        .eq('id', clip.id);
    }
  }
  
  // Check if all clips done
  const { data: updatedClips } = await supabase.from('clips')
    .select('status, video_url')
    .eq('job_id', jobId);
  
  const doneCount = (updatedClips || []).filter(c => c.status === 'done' && c.video_url).length;
  console.log('Done clips:', doneCount, '/', (updatedClips || []).length);
  
  if (doneCount > 0) {
    await supabase.from('jobs').update({ status: 'stitching' }).eq('id', jobId);
    console.log('Job', jobId, 'ready for stitch');
  }
}

async function main() {
  await processJob(5);
  await processJob(6);
  await processJob(7);
  await processJob(8);
}

main().catch(console.error);
