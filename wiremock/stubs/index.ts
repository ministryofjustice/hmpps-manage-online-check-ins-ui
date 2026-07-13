import fs from 'fs'
import path from 'path'
import superagent from 'superagent'
import eSupervisionAPI from './eSupervisionAPI'

const wiremockAdminUrl = 'http://localhost:9091/__admin'
const mappingsDir = path.resolve(__dirname, '../mappings')

const importFileMappings = (): Promise<superagent.Response[]> =>
  Promise.all(
    fs
      .readdirSync(mappingsDir)
      .filter(file => file.endsWith('.json'))
      .map(file =>
        superagent
          .post(`${wiremockAdminUrl}/mappings/import`)
          .send(JSON.parse(fs.readFileSync(path.join(mappingsDir, file), 'utf8'))),
      ),
  )

export default {
  resetMocks: async (): Promise<null> => {
    await superagent.post(`${wiremockAdminUrl}/mappings/reset`)
    await importFileMappings()
    return null
  },
  ...eSupervisionAPI,
}
