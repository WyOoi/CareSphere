import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch(`${API_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const payload = await response.json();

    if (!response.ok) {
      return NextResponse.json(payload, { status: response.status });
    }

    return NextResponse.json(payload.data || payload, { status: 201 });
  } catch (error) {
    console.error('[auth/signup] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: `Signup failed: backend API unreachable at ${API_URL}. Ensure backend is running.`,
      },
      { status: 503 }
    );
  }
}
