export const RULE_JAVA = {
  ruleName: 'Java',
  ruleCategory: 'regex_title',
  pattern: '(?i)\\bjava\\b',
  signalType: 'skill_match',
}

export const RULE_RECRUITER = {
  ruleName: 'Recruiter',
  ruleCategory: 'regex_company',
  pattern: '(?i)recruit',
  signalType: 'company_match',
}
