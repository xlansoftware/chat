import { NextRequest } from "next/server";

export function getSessionId(req: NextRequest) {
  return req.headers.get('x-test-session')
    ?? req.nextUrl.searchParams.get('testSession')
    ?? 'default';
}
