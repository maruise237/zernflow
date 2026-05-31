-- Expand local channel constraints to match Zernio's 15 social platforms.
-- Ads accounts remain out of channels because they are not messaging/posting identities.

ALTER TABLE channels DROP CONSTRAINT IF EXISTS channels_platform_check;
ALTER TABLE channels ADD CONSTRAINT channels_platform_check
  CHECK (platform IN (
    'facebook',
    'instagram',
    'twitter',
    'tiktok',
    'youtube',
    'linkedin',
    'threads',
    'pinterest',
    'telegram',
    'bluesky',
    'reddit',
    'whatsapp',
    'googlebusiness',
    'snapchat',
    'discord'
  ));

ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_platform_check;
ALTER TABLE conversations ADD CONSTRAINT conversations_platform_check
  CHECK (platform IN (
    'facebook',
    'instagram',
    'twitter',
    'tiktok',
    'youtube',
    'linkedin',
    'threads',
    'pinterest',
    'telegram',
    'bluesky',
    'reddit',
    'whatsapp',
    'googlebusiness',
    'snapchat',
    'discord'
  ));
