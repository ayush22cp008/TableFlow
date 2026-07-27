import { NextResponse } from 'next/server'

export async function GET() {
  // Placeholder API Route for Vibethon
  return NextResponse.json(
    { 
      message: 'Hello from Vibethon API!',
      status: 'Ready to build'
    },
    { status: 200 }
  )
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    // Handle incoming data
    return NextResponse.json({ received: true, data: body })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
