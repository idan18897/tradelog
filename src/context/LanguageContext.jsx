import { createContext, useContext, useEffect } from 'react'

const translations = {
  dashboard: 'Dashboard',
  journal: 'Trade Journal',
  newTrade: 'New Trade',
  settings: 'Settings',
  logout: 'Logout',
  winRate: 'Win Rate',
  monthlyPnl: 'Monthly P&L',
  avgRR: 'Avg R:R',
  openTrades: 'Open Trades',
  weeklyPnl: 'Weekly P&L',
  outcomeBreakdown: 'Outcome Breakdown',
  recentTrades: 'Recent 5 Trades',
  viewAll: 'View All',
  week: 'Week',
  noTrades: 'No trades yet',
  journalTitle: 'Trade Journal',
  date: 'Date',
  time: 'Time',
  pair: 'Pair',
  direction: 'Direction',
  entry: 'Entry',
  slPips: 'SL Pips',
  rr: 'R:R',
  risk: 'Risk%',
  outcome: 'Outcome',
  confirmations: 'Confirmations',
  screenshot: 'Screenshot',
  actions: 'Actions',
  filterPair: 'All Pairs',
  filterOutcome: 'All Outcomes',
  filterDirection: 'All Directions',
  noResults: 'No trades found',
  deleteConfirm: 'Delete this trade?',
  newTradeTitle: 'New Trade',
  editTradeTitle: 'Edit Trade',
  basicDetails: 'Basic Details',
  prices: 'Prices',
  rrPotential: 'R:R (Potential)',
  notes: 'Notes',
  notesPlaceholder: 'Trade description, entry reasons...',
  screenshotLabel: 'Screenshot',
  dropzone: 'Drop image here or click to upload',
  save: 'Save Changes',
  add: 'Add Trade',
  saving: 'Saving...',
  adding: 'Adding...',
  cancel: 'Cancel',
  removeImage: 'Remove Image',
  settingsTitle: 'Settings',
  confirmationsLibrary: 'Confirmations Library',
  newConfirmationPlaceholder: 'New confirmation name...',
  addBtn: 'Add',
  noConfirmations: 'No confirmations yet',
  account: 'Account',
  email: 'Email',
  duplicateConfirmation: 'This confirmation already exists',
  saved: 'Saved ✓',
  pairsLibrary: 'Pairs Management',
  pairsDesc: 'Pairs shown in the new trade form',
  newPairPlaceholder: 'Pair symbol, e.g. BTCUSD',
  defaultRisk: 'Default Risk %',
  defaultRiskDesc: 'Risk % loaded automatically for each new trade',
  tradeRating: 'Trade Rating',
  tradeRatingHint: 'How good was the setup? (optional)',
  loginTitle: 'TradeLog',
  loginSubtitle: 'Smart Trading Journal',
  emailLabel: 'Email',
  passwordLabel: 'Password',
  loginBtn: 'Sign In',
  signupBtn: 'Sign Up',
  switchToSignup: "Don't have an account? Sign Up",
  switchToLogin: 'Already registered? Sign In',
  signupSuccess: 'Verification email sent — check your inbox',
  appearance: 'Appearance',
  darkMode: 'Dark Mode',
  language: 'Language',
}

const LanguageContext = createContext()

export function LanguageProvider({ children }) {
  useEffect(() => {
    document.documentElement.lang = 'en'
    document.documentElement.dir = 'ltr'
  }, [])

  return (
    <LanguageContext.Provider value={{ lang: 'en', t: translations }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLang = () => useContext(LanguageContext)
