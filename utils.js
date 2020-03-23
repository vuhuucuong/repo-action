const fs = require('fs')
const readline = require('readline')
const { Readable } = require('stream')
const fsPromises = fs.promises

/**
 * Temporary create two file
 *
 * @param {{path: string, line: number}} object
 * @return {Promise<{headFilePath: string, tailFilePath: string}>} n
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
 * Insert <content> into file at <line> number,
 * This mechanism is able to handle big file
 *
 * @param {{path: string, line: number, content: string}} object
 * @return {Promise<undefined>} n
 */
const insertIntoLine = async ({ path, line, content }) => {
  try {
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

    newFileWriteStream.on('finish', async () => {
      ;[headStream, contentStream, tailStream, newFileWriteStream].forEach(stream => stream.destroy())
      // remove temp files
      await Promise.all([fsPromises.unlink(headFilePath), fsPromises.unlink(tailFilePath)])
      console.log('Succeed')
    })
  } catch (err) {
    console.err('An error happened!\n')
    throw err
  }
}

insertIntoLine({
  path: './aml-checklist.md',
  line: 9,
  content: `
Release: foundations-ts-definitions_v0.0.75
Rollback: foundations-ts-definitions_v0.0.74
Changes:
commit | author |description
  
- 49efd7305e14ae8e74ed9cbf76b59041f4cbca90 | Github Actions <GithubActions@email.com> | chore: update TypeScript definition - time stamp: 2020-02-20

approver: @willmcvay
monitor: https://sentry.io/organizations/reapit-ltd/projects/
`,
})