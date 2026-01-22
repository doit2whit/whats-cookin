import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createSession, setSessionCookie } from '../lib/auth'
import { getRows, SHEETS } from '../lib/sheets'

interface GoogleUserInfo {
  email: string
  name: string
  picture?: string
}

async function getGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    throw new Error('Failed to get user info from Google')
  }

  return response.json()
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { credential } = req.body

    if (!credential) {
      return res.status(400).json({ error: 'Missing credential' })
    }

    // Get user info from Google
    const userInfo = await getGoogleUserInfo(credential)

    // Check if user is in the allowed users list
    const rows = await getRows(SHEETS.ALLOWED_USERS)

    // Skip header row, find user by email (column 0)
    const allowedUser = rows.slice(1).find(row => row[0]?.toLowerCase() === userInfo.email.toLowerCase())

    if (!allowedUser) {
      return res.status(403).json({
        error: 'Access denied. Your account is not authorized to use this application.',
        code: 'UNAUTHORIZED',
      })
    }

    // Create session
    const sessionPayload = {
      email: userInfo.email,
      name: allowedUser[1] || userInfo.name, // Use name from sheet, fallback to Google name
      role: (allowedUser[2] as 'admin' | 'user') || 'user',
    }

    const token = await createSession(sessionPayload)
    setSessionCookie(res, token)

    return res.status(200).json({
      user: sessionPayload,
    })
  } catch (error) {
    console.error('Login error:', error)
    return res.status(500).json({ error: 'Login failed', code: 'SHEETS_ERROR' })
  }
}
