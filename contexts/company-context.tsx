"use client"

import * as React from "react"

// Firma tipi
export interface Company {
  id: string
  name: string
  code: string
}

// Firma listesi
export const companies: Company[] = [
  { id: "acme-corp", name: "ACME Corporation", code: "AC" },
  { id: "acme-tech", name: "ACME Technology", code: "AT" },
  { id: "acme-retail", name: "ACME Retail", code: "AR" },
  { id: "acme-logistics", name: "ACME Logistics", code: "AL" },
]

// Context tipi
interface CompanyContextType {
  selectedCompany: string
  setSelectedCompany: (companyId: string) => void
  currentCompany: Company | undefined
  companies: Company[]
}

const CompanyContext = React.createContext<CompanyContextType | undefined>(undefined)

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const [selectedCompany, setSelectedCompany] = React.useState<string>("acme-corp")

  const currentCompany = companies.find(c => c.id === selectedCompany)

  return (
    <CompanyContext.Provider value={{ 
      selectedCompany, 
      setSelectedCompany, 
      currentCompany,
      companies 
    }}>
      {children}
    </CompanyContext.Provider>
  )
}

export function useCompany() {
  const context = React.useContext(CompanyContext)
  if (context === undefined) {
    throw new Error("useCompany must be used within a CompanyProvider")
  }
  return context
}

