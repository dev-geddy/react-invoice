/** Quick-jump destinations — real routes + action shortcuts. Shared by the
 *  header search and the Overview quick-jump. */
export const JUMP_GROUPS: {
  heading: string
  items: { label: string; href: string; keywords: string }[]
}[] = [
  {
    heading: "Pages",
    items: [
      { label: "Overview", href: "/backflip", keywords: "dashboard home" },
      {
        label: "Invoices",
        href: "/backflip/invoicing/invoices",
        keywords: "invoice billing customers vat entries",
      },
      {
        label: "Customers",
        href: "/backflip/invoicing/customers",
        keywords: "customer client address book company",
      },
      {
        label: "Series & currency",
        href: "/backflip/invoicing/settings",
        keywords: "series numbering brand branding currency invoice settings",
      },
      {
        label: "Members",
        href: "/backflip/users",
        keywords: "users people team",
      },
      {
        label: "Account",
        href: "/backflip/account",
        keywords: "profile email password my account",
      },
      {
        label: "Docs",
        href: "/backflip/docs",
        keywords: "documentation constitution contracts notes spec l1 l2 l3",
      },
      {
        label: "Integrations",
        href: "/backflip/settings",
        keywords: "settings ai providers email resend keys",
      },
    ],
  },
  {
    heading: "Actions",
    items: [
      {
        label: "New invoice",
        href: "/backflip/invoicing/invoices/new",
        keywords: "create invoice bill draft",
      },
      {
        label: "Add member",
        href: "/backflip/users",
        keywords: "new user invite create",
      },
      {
        label: "Change password",
        href: "/backflip/account",
        keywords: "security reset",
      },
    ],
  },
]
