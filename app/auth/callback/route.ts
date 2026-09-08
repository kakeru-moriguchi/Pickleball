import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  let next = new URL('/', url.origin);
  try {
    const destination = new URL(url.searchParams.get('next') || '/', url.origin);
    if (destination.origin === url.origin) next = destination;
  } catch {
    // Invalid return paths fall back to the home page.
  }
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(next);
  }
  return NextResponse.redirect(new URL('/login?error=callback', url.origin));
}
