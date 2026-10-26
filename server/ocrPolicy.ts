// Reading text from a photo sends the photo to Google Cloud Vision and the text to a model provider. Health documents are not
// sent to third parties by default, so this is off unless ALLOW_THIRD_PARTY_OCR=true is set on purpose.
export const thirdPartyOcrOn = (env: Record<string, string | undefined> = process.env) => String(env.ALLOW_THIRD_PARTY_OCR ?? '').toLowerCase() === 'true';
