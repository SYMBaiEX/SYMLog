import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  // Handle authentication errors
  if (error) {
    console.error('Authentication error:', error)
    return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(error)}`, request.url))
  }

  // Handle successful authentication with code
  if (code) {
    // Authentication code received successfully
    
    // For web environment, redirect to home with code in hash
    const redirectUrl = new URL('/', request.url)
    redirectUrl.hash = `auth-code=${encodeURIComponent(code)}`
    
    return NextResponse.redirect(redirectUrl.toString())
  }

  // No code or error, redirect to home
  return NextResponse.redirect(new URL('/', request.url))
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { authCode, action } = body

    if (action === 'validate') {
      // This would integrate with your Convex validation
      // For now, just return success
      return NextResponse.json({ 
        success: true, 
        message: 'Auth code received',
        code: authCode 
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Auth callback error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}