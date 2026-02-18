export async function GET() {
  return Response.json({
    version: process.env.APP_VERSION,
    commit: process.env.APP_COMMIT_HASH,
    buildDate: process.env.APP_BUILD_DATE,
  })
}
