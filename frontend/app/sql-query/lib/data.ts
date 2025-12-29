import type { Schema } from "./types"

// Örnek veritabanı şeması
export const sampleSchema: Schema = {
  name: "Sample Database",
  models: [
    { name: "Orders + People", id: 1 }
  ],
  tables: [
    {
      name: "ACCOUNTS",
      columns: [
        { name: "ID", type: "BigInteger" },
        { name: "EMAIL", type: "String" },
        { name: "FIRST_NAME", type: "String" },
        { name: "LAST_NAME", type: "String" },
        { name: "PLAN", type: "String" },
        { name: "SOURCE", type: "String" },
        { name: "SEATS", type: "Integer" },
        { name: "CREATED_AT", type: "DateTime" },
        { name: "TRIAL_ENDS_AT", type: "DateTime" },
        { name: "CANCELED_AT", type: "DateTime" },
        { name: "ACTIVE_SUBSCRIPTION", type: "Boolean" },
      ]
    },
    {
      name: "ANALYTIC_EVENTS",
      columns: [
        { name: "ID", type: "BigInteger" },
        { name: "ACCOUNT_ID", type: "BigInteger", fk: "ACCOUNTS" },
        { name: "EVENT_TYPE", type: "String" },
        { name: "EVENT_DATA", type: "JSON" },
        { name: "CREATED_AT", type: "DateTime" },
      ]
    },
    {
      name: "FEEDBACK",
      columns: [
        { name: "ID", type: "BigInteger" },
        { name: "ACCOUNT_ID", type: "BigInteger", fk: "ACCOUNTS" },
        { name: "RATING", type: "Integer" },
        { name: "COMMENT", type: "Text" },
        { name: "CREATED_AT", type: "DateTime" },
      ]
    },
    {
      name: "INVOICES",
      columns: [
        { name: "ID", type: "BigInteger" },
        { name: "ACCOUNT_ID", type: "BigInteger", fk: "ACCOUNTS" },
        { name: "AMOUNT", type: "Decimal" },
        { name: "STATUS", type: "String" },
        { name: "DUE_DATE", type: "Date" },
        { name: "PAID_AT", type: "DateTime" },
      ]
    },
    {
      name: "ORDERS",
      columns: [
        { name: "ID", type: "BigInteger" },
        { name: "USER_ID", type: "BigInteger", fk: "PEOPLE" },
        { name: "PRODUCT_ID", type: "BigInteger", fk: "PRODUCTS" },
        { name: "QUANTITY", type: "Integer" },
        { name: "TOTAL", type: "Decimal" },
        { name: "CREATED_AT", type: "DateTime" },
      ]
    },
    {
      name: "PEOPLE",
      columns: [
        { name: "ID", type: "BigInteger" },
        { name: "NAME", type: "String" },
        { name: "EMAIL", type: "String" },
        { name: "CITY", type: "String" },
        { name: "CREATED_AT", type: "DateTime" },
      ]
    },
    {
      name: "PRODUCTS",
      columns: [
        { name: "ID", type: "BigInteger" },
        { name: "NAME", type: "String" },
        { name: "CATEGORY", type: "String" },
        { name: "PRICE", type: "Decimal" },
        { name: "VENDOR", type: "String" },
      ]
    },
    {
      name: "REVIEWS",
      columns: [
        { name: "ID", type: "BigInteger" },
        { name: "PRODUCT_ID", type: "BigInteger", fk: "PRODUCTS" },
        { name: "USER_ID", type: "BigInteger", fk: "PEOPLE" },
        { name: "RATING", type: "Integer" },
        { name: "COMMENT", type: "Text" },
        { name: "CREATED_AT", type: "DateTime" },
      ]
    },
  ]
}

// Örnek sorgu sonuçları - 50 satır
export const sampleResults = Array.from({ length: 50 }, (_, i) => {
  const sources = ["Facebook", "Twitter", "Google", "LinkedIn", "Instagram", ""]
  const plans = ["Basic", "Pro", "Enterprise", "Starter"]
  const firstNames = ["Macy", "Kim", "Princess", "Jeramie", "Clay", "Magnus", "Mekhi", "Sarah", "John", "Emma", "Oliver", "Sophia", "Liam", "Isabella", "Noah"]
  const lastNames = ["Kub", "Cormier", "Tillman", "Pfannerstill", "Johnston", "Carroll", "O'Conner", "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis"]

  const firstName = firstNames[i % firstNames.length]
  const lastName = lastNames[i % lastNames.length]
  const source = sources[i % sources.length]
  const plan = plans[i % plans.length]

  return {
    ID: i + 1,
    EMAIL: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@example.com`,
    FIRST_NAME: firstName,
    LAST_NAME: lastName,
    PLAN: plan,
    SOURCE: source,
    SEATS: Math.floor(Math.random() * 50) + 1,
    CREATED_AT: `Eylül ${(i % 28) + 1}, 2020, ${(i % 12) + 1}:${String(i % 60).padStart(2, '0')} ${i % 2 === 0 ? 'AM' : 'PM'}`,
    TRIAL_ENDS_AT: `Ekim ${(i % 28) + 1}, 2020, 12:00 PM`,
    CANCELED_AT: i % 5 === 0 ? `Kasım ${(i % 28) + 1}, 2020, 12:00 PM` : "",
    ACTIVE_SUBSCRIPTION: i % 3 !== 0,
  }
})

// Örnek bağlantılar
export const sampleConnections = [
  { id: "default", name: "Varsayılan Bağlantı", type: "Arrow Flight" },
  { id: "local", name: "Yerel Veritabanı (SQLite)", type: "SQLite" },
]

