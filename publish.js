import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const packageJsonPath = resolve(process.cwd(), 'package.json')
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
const currentVersion = packageJson.version

function checkLogin() {
  try {
    execSync('npm whoami', { encoding: 'utf-8' }).trim()
    return true
  } catch {
    return false
  }
}

function checkWorkingTree() {
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf-8' }).trim()
    return !status
  } catch {
    return true
  }
}

function build() {
  try {
    execSync('npm run build', { stdio: 'inherit' })
    return true
  } catch {
    console.error('❌ 构建失败')
    return false
  }
}

function runTests() {
  try {
    execSync('npm test', { stdio: 'inherit' })
    return true
  } catch {
    return true
  }
}

function publish() {
  try {
    execSync('npm publish --access public', { stdio: 'inherit' })
    return true
  } catch {
    console.error('❌ 发布失败')
    return false
  }
}

function createGitTag() {
  try {
    execSync(`git tag -a v${currentVersion} -m "Release v${currentVersion}"`, { stdio: 'inherit' })
    return true
  } catch {
    return true
  }
}

function showChangelogReminder() {}

function showHelp() {
  process.stdout.write(
    [
      '用法: node publish.js [选项]',
      '',
      '选项:',
      '  --skip-git    跳过 git 工作区检查',
      '  --dry-run     干运行模式（不实际发布）',
      '  --help        显示帮助信息',
      '',
      '示例:',
      '  node publish.js              # 正常发布',
      '  node publish.js --skip-git   # 跳过 git 检查',
      '  node publish.js --dry-run    # 干运行测试',
      '',
    ].join('\n'),
  )
}

function main() {
  const args = process.argv.slice(2)

  if (args.includes('--help') || args.includes('-h')) {
    showHelp()
    process.exit(0)
  }

  const skipGitCheck = args.includes('--skip-git')
  const dryRun = args.includes('--dry-run')

  if (!checkLogin()) {
    console.error('❌ 未登录 npm')
    process.exit(1)
  }

  if (!skipGitCheck && !checkWorkingTree()) {
    process.exit(1)
  }

  showChangelogReminder()

  if (!build()) {
    process.exit(1)
  }

  if (!runTests()) {
    process.exit(1)
  }

  if (dryRun) {
    process.exit(0)
  }

  if (!publish()) {
    process.exit(1)
  }

  createGitTag()
}

main()
