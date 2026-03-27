import { spawn, execSync } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { log, getIFlowConfigPath, getIFlowOAuthCredsPath } from './utils.js'
import * as logger from '../../plugin/logger.js'

export function checkIFlowCLI(): { installed: boolean; version?: string; error?: string } {
  try {
    const configPath = getIFlowConfigPath()
    const credsPath = getIFlowOAuthCredsPath()
    
    if (existsSync(configPath) || existsSync(credsPath)) {
      log('iflow CLI config found at:', configPath)
      return { installed: true, version: 'installed' }
    }
    
    execSync('where iflow 2>nul || which iflow 2>/dev/null', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] })
    log('iflow CLI executable found')
    return { installed: true, version: 'installed' }
  } catch (error: any) {
    log('iflow CLI check failed:', error.message)
    return { installed: false, error: 'iflow CLI not found' }
  }
}

export function checkIFlowLogin(): { loggedIn: boolean; error?: string; apiKey?: string } {
  try {
    const oauthCredsPath = getIFlowOAuthCredsPath()
    
    if (!existsSync(oauthCredsPath)) {
      log('OAuth creds file not found:', oauthCredsPath)
      return { loggedIn: false, error: 'Not logged in - no oauth_creds.json' }
    }
    
    const credsContent = readFileSync(oauthCredsPath, 'utf-8')
    const creds = JSON.parse(credsContent)
    
    if (!creds.access_token && !creds.apiKey) {
      return { loggedIn: false, error: 'Not logged in - no token' }
    }
    
    if (creds.expiry_date && Date.now() > creds.expiry_date) {
      return { loggedIn: false, error: 'Token expired' }
    }
    
    log('iflow CLI is logged in:', creds.userName || creds.userId)
    return { loggedIn: true, apiKey: creds.apiKey }
  } catch (error: any) {
    log('Error checking iflow login:', error.message)
    return { loggedIn: false, error: error.message }
  }
}

export async function triggerIFlowLogin(): Promise<{ success: boolean; error?: string }> {
  log('Triggering iflow login...')
  logger.error('[IFlowProxy] Please login to iflow CLI...')
  logger.error('[IFlowProxy] Run: iflow login')
  
  return new Promise((resolve) => {
    const loginProcess = spawn('iflow', ['login'], {
      shell: true,
      stdio: 'inherit'
    })
    
    loginProcess.on('close', (code) => {
      if (code === 0) {
        log('iflow login successful')
        resolve({ success: true })
      } else {
        resolve({ success: false, error: `Login process exited with code ${code}` })
      }
    })
    
    loginProcess.on('error', (err) => {
      resolve({ success: false, error: err.message })
    })
  })
}

export async function installIFlowCLI(): Promise<{ success: boolean; error?: string }> {
  log('Attempting to install iflow CLI...')
  logger.error('[IFlowProxy] Installing iflow CLI...')
  
  return new Promise((resolve) => {
    try {
      const npm = spawn('npm', ['install', '-g', 'iflow-cli'], {
        shell: true,
        stdio: 'inherit'
      })

      npm.on('error', (err) => {
        logger.error('[IFlowProxy] Failed to install iflow CLI:', err.message)
        resolve({ success: false, error: err.message })
      })

      npm.on('close', (code) => {
        if (code === 0) {
          logger.error('[IFlowProxy] iflow CLI installed successfully!')
          logger.error('[IFlowProxy] Please run: iflow login')
          resolve({ success: true })
        } else {
          logger.error('[IFlowProxy] Installation failed with code:', code)
          resolve({ success: false, error: `npm install exited with code ${code}` })
        }
      })
    } catch (error: any) {
      logger.error('[IFlowProxy] Failed to start npm install:', error.message)
      resolve({ success: false, error: error.message })
    }
  })
}
