// ============================================================
// Network Printer API
// ============================================================
// POST /api/print/network
// Sends raw ESC/POS bytes to a network thermal printer via TCP.
// Browsers can't do raw TCP, so this server-side endpoint acts as a proxy.
//
// Body: {
//   ipAddress: string,  // e.g., "192.168.1.100"
//   port: number,       // usually 9100
//   data: number[]      // raw ESC/POS byte array
// }
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import * as net from 'net'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { ipAddress, port, data } = body as {
      ipAddress: string
      port: number
      data: number[]
    }

    if (!ipAddress || !port || !data || !Array.isArray(data)) {
      return NextResponse.json(
        { error: 'ipAddress, port, and data (number[]) are required' },
        { status: 400 }
      )
    }

    // Validate IP address format
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/
    if (!ipRegex.test(ipAddress)) {
      return NextResponse.json(
        { error: 'Invalid IP address format' },
        { status: 400 }
      )
    }

    // Validate port range
    if (port < 1 || port > 65535) {
      return NextResponse.json(
        { error: 'Port must be between 1 and 65535' },
        { status: 400 }
      )
    }

    // Convert data array to Buffer
    const buffer = Buffer.from(data)

    // Connect to the printer and send the data
    const result = await new Promise<{ success: boolean; error?: string }>((resolve) => {
      const socket = new net.Socket()
      let timeoutHandle: NodeJS.Timeout | null = null

      const cleanup = () => {
        if (timeoutHandle) clearTimeout(timeoutHandle)
        socket.destroy()
      }

      // 10 second timeout
      timeoutHandle = setTimeout(() => {
        cleanup()
        resolve({ success: false, error: 'Connection timed out' })
      }, 10000)

      socket.connect(port, ipAddress, () => {
        // Connected — send the data
        socket.write(buffer, (err) => {
          if (err) {
            cleanup()
            resolve({ success: false, error: `Write failed: ${err.message}` })
          } else {
            // Wait for the data to flush, then close
            socket.end(() => {
              cleanup()
              resolve({ success: true })
            })
          }
        })
      })

      socket.on('error', (err) => {
        cleanup()
        resolve({ success: false, error: `Connection failed: ${err.message}` })
      })
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to print' },
        { status: 502 }
      )
    }

    return NextResponse.json({ success: true, message: 'Data sent to printer' })
  } catch (error) {
    console.error('[PRINT_NETWORK]', error)
    return NextResponse.json(
      { error: 'Failed to send data to printer' },
      { status: 500 }
    )
  }
}
