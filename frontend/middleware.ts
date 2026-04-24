import { NextRequest, NextResponse } from 'next/server';

// Routes that belong to admin/staff only — patients should never see these
const ADMIN_ONLY_ROUTES = [
  '/',
  '/alerts',
  '/trends',
  '/caregiver',
  '/admin',
  '/audit',
  '/onboard',
  '/report',
  '/devices',
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const authCookie   = req.cookies.get('cs_auth')?.value;
  const patientId    = req.cookies.get('cs_patient_id')?.value;
  const isAuthed     = !!authCookie;
  const isPatient    = !!patientId;

  // Always allow: login, signup, Next.js internals, API routes, static files
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next();
  }

  // Not logged in → redirect to login
  if (!isAuthed) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  // Patient trying to access an admin-only route → send to their own profile
  if (isPatient && ADMIN_ONLY_ROUTES.some((r) => pathname === r || pathname.startsWith(r + '/'))) {
    const profileUrl = req.nextUrl.clone();
    profileUrl.pathname = `/patients/${patientId}`;
    return NextResponse.redirect(profileUrl);
  }

  // Patient trying to access ANOTHER patient's page → redirect to their own
  if (isPatient && pathname.startsWith('/patients/') && pathname !== `/patients/${patientId}`) {
    const profileUrl = req.nextUrl.clone();
    profileUrl.pathname = `/patients/${patientId}`;
    return NextResponse.redirect(profileUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
