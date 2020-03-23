require('dotenv').config()
const { Octokit } = require('@octokit/rest')

const octokit = new Octokit({
  auth: process.env.GH_TOKEN,
})

const getLatestRelease = async () => {


  const ock
}
getLatestRelease()
