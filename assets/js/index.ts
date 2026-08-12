import * as arnsFrontend from '@ministryofjustice/hmpps-arns-frontend-components-lib/dist/js/all'
import * as govukFrontend from 'govuk-frontend'
import * as mojFrontend from '@ministryofjustice/frontend'

import { initPhotoUpload } from './photo'

govukFrontend.initAll()
mojFrontend.initAll()
arnsFrontend.initAll()

// The file upload field's real id only exists once govukFrontend.initAll() has enhanced it.
initPhotoUpload()
