const parseQuestionTemplate = (availableTemplates: any[], questionId: string | number) => {
  const selectedTemplate = availableTemplates?.find((q: any) => String(q.id) === String(questionId))

  if (!selectedTemplate) return null

  const { template, responseSpec, questionExamples, example } = selectedTemplate
  const placeholderWord = responseSpec?.placeholders?.[0]
  const splitTarget = `{{${placeholderWord}}}`
  const [prefix, suffix = ''] = template.split(splitTarget)

  return {
    id: selectedTemplate.id,
    prefix,
    suffix,
    placeholderWord,
    questionExamples,
    // The comma-separated example placeholders stored against the template, e.g. "unpaid work, college course"
    example,
  }
}
export default parseQuestionTemplate
