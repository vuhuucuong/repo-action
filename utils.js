const fs = require('fs')
const readline = require('readline')
const { Readable } = require('stream')
const { Octokit } = require('@octokit/rest')
const dayjs = require('dayjs')
const path = require('path')
const { execSync } = require('child_process')
const fsPromises = fs.promises

/**
 * Temporary create two file with content separated by <line>
 *
 * @param {{path: string, line: number}} object
 * @return {Promise<{headFilePath: string, tailFilePath: string}>}
 */
const createHeadAndTailTempFiles = ({ path, line }) =>
  new Promise((resolve, reject) => {
    try {
      const origFileReadStream = fs.createReadStream(path)
      const rl = readline.createInterface({
        input: origFileReadStream,
        crlfDelay: Infinity,
      })
      // Temporary store the content above <line>
      const headFilePath = `${path}-head`
      const headFileWriteStream = fs.createWriteStream(headFilePath)
      // Temporary store the content below <line>
      const tailFilePath = `${path}-tail`
      const tailFileWriteStream = fs.createWriteStream(tailFilePath)
      let lineCount = 1
      rl.on('line', lineData => {
        if (lineCount < line) {
          headFileWriteStream.write(`${lineData}\r\n`)
        } else {
          tailFileWriteStream.write(`${lineData}\r\n`)
        }
        lineCount++
      })
      rl.on('close', () => {
        origFileReadStream.destroy()
        headFileWriteStream.destroy()
        tailFileWriteStream.destroy()
        console.log(`Wrote temporary head content to: ${headFilePath}`)
        console.log(`Wrote temporary tail content to: ${tailFilePath}`)
        resolve({
          headFilePath,
          tailFilePath,
        })
      })
    } catch (err) {
      reject(err)
    }
  })

/**
 * Insert <content> into file at <line> number, and remove temporary files
 * This mechanism is able to handle big file
 *
 * @param {{path: string, line: number, content: string}} inputObj
 * @return {Promise<string>} path of file with new content
 */
const insertIntoLine = async ({ path, line, content }) => {
  const { headFilePath, tailFilePath } = await createHeadAndTailTempFiles({ path, line })
  const [headStream, tailStream] = [fs.createReadStream(headFilePath), fs.createReadStream(tailFilePath)]
  const contentStream = new Readable()
  contentStream.push(`${content}\r\n`)
  // end the Readable stream
  contentStream.push(null)
  // piping in order, overwrite old original file
  const newFileWriteStream = fs.createWriteStream(path)

  headStream.pipe(newFileWriteStream, { end: false })

  headStream.on('end', () => {
    contentStream.pipe(newFileWriteStream, { end: false })
  })

  contentStream.on('end', () => {
    tailStream.pipe(newFileWriteStream, { end: true })
  })

  const newFileWriteStreamHandler = () =>
    new Promise(resolve => {
      newFileWriteStream.on('finish', async () => {
        ;[headStream, contentStream, tailStream, newFileWriteStream].forEach(stream => stream.destroy())
        // remove temp files
        await Promise.all([fsPromises.unlink(headFilePath), fsPromises.unlink(tailFilePath)])
        resolve('Success')
      })
    })
  await newFileWriteStreamHandler()
  return path
}

const getReleaseAndCreatePr = async releaseTag => {
  try {
    const packageName = releaseTag.replace(/_v.+/, '')

    const [owner, repo] = process.env.MAIN_REPO.split('/')
    const [ownerDoc, repoDoc] = process.env.DOC_REPO.split('/')

    const octokit = new Octokit({
      auth: process.env.GH_PAT,
      baseUrl: process.env.API_GITHUB_ENDPOINT,
    })
    const {
      data: { body, name, published_at: publishedAt },
    } = await octokit.repos.getReleaseByTag({
      owner,
      repo,
      tag: releaseTag,
    })

    const formattedContent = `### ${name} - ${dayjs(publishedAt).format('YYYY-MM-DD')}
  ${body}
    `
    const docRepoPath = process.env.DOC_CLONE_PATH
    const inputObj = mapPackageNameToPathLine({ docRepoPath, packageName })
    if (!inputObj) {
      throw 'No package name matched!'
    }
    const { path, line } = inputObj

    const newFilePath = await insertIntoLine({ path, line, content: formattedContent })
    const prTitle = `${releaseTag} - Document Update`
    execSync(
      `cd ${docRepoPath} && \
    git checkout -b ${releaseTag} && \
    git add ${newFilePath} && \
    git commit --author="Will McVay <wmcvay@reapit.com>" -m "${prTitle}" && \
    git push -u origin HEAD
      `,
    )
    const {
      data: { html_url },
    } = await octokit.pulls.create({
      owner: ownerDoc,
      repo: repoDoc,
      title: prTitle,
      head: releaseTag,
      base: 'master',
    })
    console.log(`Created a PR at: ${html_url}`)
    return 'Success'
  } catch (err) {
    console.error('An error happened!')
    throw err
  }
}

const mapPackageNameToPathLine = ({ docRepoPath, packageName }) => {
  const basePath = path.join(docRepoPath, 'change-logs')
  switch (packageName) {
    case 'aml-checklist':
      return {
        path: path.join(basePath, 'aml-checklist.md'),
        line: 9,
      }
    case 'cognito-auth':
      return {
        path: path.join(basePath, 'cognito-auth.md'),
        line: 9,
      }
    case 'cognito-custom-mail-lambda':
      return {
        path: path.join(basePath, 'cognito-custom-mail-lambda.md'),
        line: 9,
      }
    case 'config-manager':
      return {
        path: path.join(basePath, 'config-manager.md'),
        line: 9,
      }
    case 'demo-site':
      return {
        path: path.join(basePath, 'demo-site.md'),
        line: 9,
      }
    case 'elements':
      return {
        path: path.join(basePath, 'elements.md'),
        line: 9,
      }
    case 'foundations-ts-definitions':
      return {
        path: path.join(basePath, 'foundations-ts-definitions.md'),
        line: 9,
      }
    case 'geo-diary':
      return {
        path: path.join(basePath, 'geo-diary.md'),
        line: 9,
      }
    case 'graphql-server':
      return {
        path: path.join(basePath, 'graphql-server.md'),
        line: 9,
      }
    case 'lifetime-legal':
      return {
        path: path.join(basePath, 'lifetime-legal.md'),
        line: 9,
      }
    case 'marketplace':
      return {
        path: path.join(basePath, 'marketplace.md'),
        line: 9,
      }
    case 'react-app-scaffolder':
      return {
        path: path.join(basePath, 'react-app-scaffolder.md'),
        line: 9,
      }
    case 'smb':
      return {
        path: path.join(basePath, 'smb.md'),
        line: 9,
      }
    case 'web-components':
      return {
        path: path.join(basePath, 'web-components.md'),
        line: 9,
      }
    default:
      return null
  }
}

getReleaseAndCreatePr(process.env.CURRENT_TAG)
