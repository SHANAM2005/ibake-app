const { createClient } = require('@supabase/supabase-js');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('\n[FATAL] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in your .env file.');
  console.error('See README.md \u2192 "Setting up Supabase" for how to get these values.\n');
  process.exit(1);
}

// service_role key is used because this runs server-side only and needs
// full read/write access regardless of Row Level Security policies.
// NEVER expose this key in frontend code.
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const MENU_BUCKET = 'menu-images';
const SCREENSHOT_BUCKET = 'payment-screenshots';

/**
 * Uploads a file buffer to a Supabase Storage bucket and returns its public URL.
 */
async function uploadToBucket(bucket, filename, buffer, contentType) {
  const { error } = await supabase.storage.from(bucket).upload(filename, buffer, {
    contentType,
    upsert: false
  });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(filename);
  return data.publicUrl;
}

module.exports = { supabase, uploadToBucket, MENU_BUCKET, SCREENSHOT_BUCKET };
