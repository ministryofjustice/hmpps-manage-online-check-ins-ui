// Shows a template's placeholder as "[insert text]" for the choose-a-question list.
const toDisplayTemplates = <T extends { template: string }>(templates: T[]): (T & { displayTemplate: string })[] =>
  (templates ?? []).map(q => {
    const start = q.template.indexOf('{{')
    const end = q.template.indexOf('}}', start)

    let displayTemplate = q.template
    if (start !== -1 && end !== -1) {
      displayTemplate = `${q.template.substring(0, start)}[insert text]${q.template.substring(end + 2)}`
    }

    return { ...q, displayTemplate }
  })

export default toDisplayTemplates
