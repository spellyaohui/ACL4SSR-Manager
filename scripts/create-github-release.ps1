param(
  [string]$DocPath,
  [string]$Tag,
  [string]$Title,
  [string]$Target = "HEAD"
)

$ErrorActionPreference = "Stop"

function Invoke-Git {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Args
  )
  & git @Args
  if ($LASTEXITCODE -ne 0) {
    throw "git 命令执行失败: git $($Args -join ' ')"
  }
}

function Invoke-Gh {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Args
  )
  & gh @Args
  if ($LASTEXITCODE -ne 0) {
    throw "gh 命令执行失败: gh $($Args -join ' ')"
  }
}

function Test-CommandExists {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name
  )
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

if (-not (Test-CommandExists "git")) {
  throw "未检测到 git，请先安装 Git。"
}

if (-not (Test-CommandExists "gh")) {
  throw "未检测到 gh，请先安装 GitHub CLI。"
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
Set-Location $repoRoot

Invoke-Git -Args @("rev-parse", "--show-toplevel") | Out-Null

if (-not $DocPath) {
  $latestDoc = Get-ChildItem (Join-Path $repoRoot "Docs") -Filter "版本更新说明_*.md" |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

  if (-not $latestDoc) {
    throw "未找到 Docs/版本更新说明_*.md，请先准备中文版本更新说明。"
  }
  $DocPath = $latestDoc.FullName
}

$resolvedDoc = Resolve-Path $DocPath -ErrorAction Stop
$docName = Split-Path $resolvedDoc -Leaf

if (-not $Tag) {
  if ($docName -match "(\d{4})-(\d{2})-(\d{2})") {
    $Tag = "v$($Matches[1]).$($Matches[2]).$($Matches[3])-update"
  } else {
    throw "无法从文档名推断标签，请显式传入 -Tag。"
  }
}

if (-not $Title) {
  if ($docName -match "(\d{4}-\d{2}-\d{2})") {
    $Title = "版本更新说明（$($Matches[1])）"
  } else {
    $Title = "版本更新说明"
  }
}

Write-Host "仓库目录: $repoRoot"
Write-Host "说明文档: $resolvedDoc"
Write-Host "发布标签: $Tag"
Write-Host "发布标题: $Title"

$tagExistsLocal = $false
try {
  Invoke-Git -Args @("rev-parse", "--verify", "refs/tags/$Tag") | Out-Null
  $tagExistsLocal = $true
} catch {
  $tagExistsLocal = $false
}

if (-not $tagExistsLocal) {
  Write-Host "本地不存在标签 $Tag，正在基于 $Target 创建..."
  Invoke-Git -Args @("tag", $Tag, $Target)
}

Write-Host "推送标签到 origin..."
Invoke-Git -Args @("push", "origin", "refs/tags/$Tag")

# GitHub Releases API 不接受 HEAD 作为 target_commitish，需要传具体的 commit SHA 或分支名。
# 这里把 $Target 统一解析为具体的 commit SHA，避免本地工作树状态影响发布结果。
$resolvedTargetSha = (& git rev-parse --verify "$Target^{commit}").Trim()
if ($LASTEXITCODE -ne 0 -or -not $resolvedTargetSha) {
  throw "无法解析目标提交：$Target"
}
Write-Host "解析目标提交: $Target -> $resolvedTargetSha"

$releaseExists = $false
& gh release view $Tag --json url *> $null
if ($LASTEXITCODE -eq 0) {
  $releaseExists = $true
}

if ($releaseExists) {
  Write-Host "Release 已存在，正在更新中文说明..."
  Invoke-Gh -Args @("release", "edit", $Tag, "--title", $Title, "--notes-file", $resolvedDoc)
} else {
  Write-Host "正在创建 Release..."
  Invoke-Gh -Args @("release", "create", $Tag, "--title", $Title, "--notes-file", $resolvedDoc, "--target", $resolvedTargetSha)
}

$releaseUrl = (& gh release view $Tag --json url -q ".url").Trim()
if ($LASTEXITCODE -ne 0) {
  throw "Release 已创建/更新，但获取链接失败。"
}

Write-Host ""
Write-Host "Release 处理完成：$releaseUrl"
