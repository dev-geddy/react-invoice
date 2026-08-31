"use client"

/** Component demo gallery + dark toggle. @spec L2-UI-05, L2-UI-12 */

import { useState } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
} from "recharts"
import {
  RiAddLine,
  RiArrowRightLine,
  RiArrowRightSLine,
  RiBankCardLine,
  RiBankLine,
  RiBellLine,
  RiCloseLine,
  RiCupLine,
  RiDashboardLine,
  RiErrorWarningLine,
  RiImageLine,
  RiLineChartLine,
  RiLockLine,
  RiRepeatLine,
  RiSearchLine,
  RiShoppingCartLine,
  RiSunLine,
  RiTimerLine,
  RiUserLine,
  RiVolumeUpLine,
  RiWalletLine,
} from "@remixicon/react"
import { toast } from "sonner"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/ui/components/accordion"
import { Badge } from "@workspace/ui/components/badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb"
import { Button } from "@workspace/ui/components/button"
import { Calendar } from "@workspace/ui/components/calendar"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  ChartContainer,
  type ChartConfig,
} from "@workspace/ui/components/chart"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@workspace/ui/components/input-group"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@workspace/ui/components/item"
import { Label } from "@workspace/ui/components/label"
import {
  NativeSelect,
  NativeSelectOption,
} from "@workspace/ui/components/native-select"
import { Progress } from "@workspace/ui/components/progress"
import {
  RadioGroup,
  RadioGroupItem,
} from "@workspace/ui/components/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Separator } from "@workspace/ui/components/separator"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Slider } from "@workspace/ui/components/slider"
import { Spinner } from "@workspace/ui/components/spinner"
import { Switch } from "@workspace/ui/components/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@workspace/ui/components/table"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { Textarea } from "@workspace/ui/components/textarea"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"

const barData = [
  { m: "Dec", v: 92 },
  { m: "Jan", v: 127 },
  { m: "Feb", v: 104 },
  { m: "Mar", v: 150 },
  { m: "Apr", v: 87 },
  { m: "May", v: 162 },
]
const barConfig = {
  v: { label: "Amount", color: "var(--chart-2)" },
} satisfies ChartConfig

const areaData = [
  { m: "Jan", p: 402 },
  { m: "Feb", p: 410 },
  { m: "Mar", p: 388 },
  { m: "Apr", p: 421 },
  { m: "May", p: 405 },
  { m: "Jun", p: 448 },
]
const areaConfig = {
  p: { label: "Price", color: "var(--chart-1)" },
} satisfies ChartConfig

const donutData = [
  { k: "saved", v: 80, fill: "var(--chart-2)" },
  { k: "remaining", v: 20, fill: "var(--chart-1)" },
]
const donutConfig = {
  saved: { label: "Saved", color: "var(--chart-2)" },
  remaining: { label: "Remaining", color: "var(--chart-1)" },
} satisfies ChartConfig

// Stable references — base-ui warns if an uncontrolled default value
// changes identity between renders.
const SCENE_DEFAULT = ["cooking"]
const FILTER_DEFAULT = ["etfs"]
const LIGHT_SCENES = [
  { icon: RiSunLine, t: "Brightness", v: [90] },
  { icon: RiVolumeUpLine, t: "Volume", v: [30] },
]

function DashCard({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <Card className={className}>{children}</Card>
}

export default function UISamplesPage() {
  const [threshold, setThreshold] = useState([2500])

  return (
    <main className="min-h-svh bg-muted px-4 py-8 md:px-8 dark:bg-background">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-medium tracking-tight">UI Samples</h1>
          <p className="text-sm text-muted-foreground">
            Every component from the <code>base-mira</code> preset, arranged as
            a dashboard. Press{" "}
            <kbd className="rounded bg-background px-1 font-mono text-xs">
              d
            </kbd>{" "}
            to toggle dark mode.
          </p>
        </header>

        <div className="columns-1 gap-6 space-y-6 md:columns-2 xl:columns-3 [&>*]:mb-6 [&>*]:break-inside-avoid">
          {/* Contribution history — bar chart */}
          <DashCard>
            <CardHeader>
              <CardTitle>Contribution History</CardTitle>
              <CardDescription>Last 6 months of activity</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={barConfig} className="h-[180px] w-full">
                <BarChart data={barData}>
                  <XAxis dataKey="m" tickLine={false} axisLine={false} />
                  <Bar dataKey="v" fill="var(--color-v)" radius={6} />
                </BarChart>
              </ChartContainer>
            </CardContent>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <Item variant="muted" className="flex-col items-stretch">
                  <ItemContent>
                    <ItemDescription className="text-xs font-medium tracking-wider uppercase">
                      Upcoming
                    </ItemDescription>
                    <span className="text-lg font-semibold">May 25, 2024</span>
                    <span className="text-sm text-muted-foreground">
                      $1,000 scheduled
                    </span>
                  </ItemContent>
                </Item>
                <Item variant="muted" className="flex-col items-stretch">
                  <ItemContent>
                    <ItemDescription className="text-xs font-medium tracking-wider uppercase">
                      Auto-Save Plan
                    </ItemDescription>
                    <span className="text-lg font-semibold">Accelerated</span>
                    <span className="text-sm text-muted-foreground">
                      Recurring weekly
                    </span>
                  </ItemContent>
                </Item>
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full">View Full Report</Button>
            </CardFooter>
          </DashCard>

          {/* Payout threshold — fields, select, slider, textarea */}
          <DashCard>
            <CardHeader>
              <CardTitle>Payout Threshold</CardTitle>
              <CardDescription>
                Minimum balance before a payout triggers.
              </CardDescription>
              <CardAction>
                <Button size="icon-sm" variant="ghost" aria-label="Dismiss">
                  <RiCloseLine />
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="currency">Preferred Currency</FieldLabel>
                  <Select defaultValue="usd">
                    <SelectTrigger id="currency" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="usd">USD — US Dollar</SelectItem>
                      <SelectItem value="eur">EUR — Euro</SelectItem>
                      <SelectItem value="gbp">GBP — Pound</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <div className="flex items-baseline justify-between">
                    <FieldLabel htmlFor="payout">Minimum Payout</FieldLabel>
                    <span className="text-2xl font-semibold tabular-nums">
                      ${threshold[0]?.toFixed(2)}
                    </span>
                  </div>
                  <Slider
                    id="payout"
                    value={threshold}
                    onValueChange={(v) =>
                      setThreshold(Array.isArray(v) ? [...v] : [v])
                    }
                    min={50}
                    max={10000}
                    step={50}
                  />
                  <div className="flex justify-between">
                    <FieldDescription>$50 (MIN)</FieldDescription>
                    <FieldDescription>$10,000 (MAX)</FieldDescription>
                  </div>
                </Field>
                <Field>
                  <FieldLabel htmlFor="notes">Notes</FieldLabel>
                  <Textarea
                    id="notes"
                    placeholder="Add any notes for this payout…"
                  />
                </Field>
              </FieldGroup>
            </CardContent>
            <CardFooter>
              <Button className="w-full">Save Threshold</Button>
            </CardFooter>
          </DashCard>

          {/* Claimable balance */}
          <DashCard>
            <CardHeader>
              <CardDescription>Claimable Balance</CardDescription>
              <CardTitle className="text-5xl tabular-nums">$0.00</CardTitle>
              <Badge variant="outline">
                <span className="size-2 rounded-full bg-yellow-500" />
                Pending Setup
              </Badge>
            </CardHeader>
            <CardContent>
              <Item variant="muted" className="flex-col items-stretch">
                <ItemContent className="gap-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      Net Royalties
                    </span>
                    <span className="text-sm font-medium tabular-nums">
                      $0.00
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      Processing Fee
                    </span>
                    <span className="text-sm font-medium tabular-nums">
                      -$0.00
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      Total Ready
                    </span>
                    <span className="text-sm font-semibold tabular-nums">
                      $0.00 USD
                    </span>
                  </div>
                </ItemContent>
              </Item>
            </CardContent>
            <CardFooter>
              <CardDescription>
                Once your bank is connected, balances over $10 are eligible for
                monthly distribution.
              </CardDescription>
            </CardFooter>
          </DashCard>

          {/* Savings donut */}
          <DashCard>
            <CardHeader>
              <CardTitle>Savings Progress</CardTitle>
              <CardDescription>Emergency fund target</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={donutConfig}
                className="mx-auto aspect-square max-h-[220px]"
              >
                <PieChart>
                  <Pie
                    data={donutData}
                    dataKey="v"
                    nameKey="k"
                    innerRadius={60}
                    strokeWidth={4}
                  >
                    {donutData.map((d) => (
                      <Cell key={d.k} fill={d.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
            </CardContent>
            <CardFooter className="flex-col gap-0">
              <div className="flex w-full justify-between py-3">
                <span className="text-sm text-muted-foreground">
                  Projected Finish
                </span>
                <span className="text-sm font-semibold">October 2024</span>
              </div>
              <Separator />
              <div className="flex w-full justify-between py-3">
                <span className="text-sm text-muted-foreground">
                  Monthly Average
                </span>
                <span className="text-sm font-semibold tabular-nums">
                  $1,250
                </span>
              </div>
            </CardFooter>
          </DashCard>

          {/* Savings targets — progress */}
          <DashCard>
            <CardHeader>
              <CardTitle>Savings Targets</CardTitle>
              <CardDescription>Active milestones for 2024</CardDescription>
              <CardAction>
                <Button size="sm" variant="outline">
                  New Goal
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              <ItemGroup className="gap-3">
                {[
                  {
                    label: "Retirement",
                    amt: "$420,000",
                    pct: 65,
                    cur: "$273,000",
                  },
                  {
                    label: "Real Estate",
                    amt: "$85,000",
                    pct: 32,
                    cur: "$27,200",
                  },
                ].map((g) => (
                  <Item
                    key={g.label}
                    variant="muted"
                    className="flex-col items-stretch"
                  >
                    <ItemContent className="gap-3">
                      <ItemDescription className="text-xs font-medium tracking-wider uppercase">
                        {g.label}
                      </ItemDescription>
                      <span className="text-3xl font-semibold tabular-nums">
                        {g.amt}
                      </span>
                      <Progress value={g.pct} />
                    </ItemContent>
                    <ItemFooter>
                      <span className="text-sm text-muted-foreground">
                        {g.pct}% achieved
                      </span>
                      <span className="text-sm font-medium tabular-nums">
                        {g.cur}
                      </span>
                    </ItemFooter>
                  </Item>
                ))}
              </ItemGroup>
            </CardContent>
          </DashCard>

          {/* Buy investment — input group, native select */}
          <DashCard>
            <CardHeader>
              <CardTitle>Buy Investment</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="amount">Amount to Invest</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon align="inline-start">
                      <InputGroupText>$</InputGroupText>
                    </InputGroupAddon>
                    <InputGroupInput id="amount" defaultValue="1,000.00" />
                  </InputGroup>
                </Field>
                <Field>
                  <FieldLabel htmlFor="order">Order Type</FieldLabel>
                  <NativeSelect id="order" className="w-full">
                    <NativeSelectOption value="market">
                      Market Order
                    </NativeSelectOption>
                    <NativeSelectOption value="limit">
                      Limit Order
                    </NativeSelectOption>
                    <NativeSelectOption value="stop">
                      Stop Order
                    </NativeSelectOption>
                  </NativeSelect>
                  <FieldDescription>
                    Market orders execute at the current price.
                  </FieldDescription>
                </Field>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    Estimated Shares
                  </span>
                  <span className="text-sm font-semibold tabular-nums">
                    1.95
                  </span>
                </div>
              </FieldGroup>
            </CardContent>
            <CardFooter>
              <Button className="w-full">Review Order</Button>
            </CardFooter>
          </DashCard>

          {/* Recent transactions — table */}
          <DashCard>
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>Your latest account activity.</CardDescription>
              <CardAction>
                <Button size="sm" variant="outline">
                  View All
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              <Table>
                <TableBody>
                  {[
                    {
                      icon: RiCupLine,
                      name: "Blue Bottle Coffee",
                      cat: "Food & Drink",
                      amt: "-$6.50",
                    },
                    {
                      icon: RiShoppingCartLine,
                      name: "Whole Foods",
                      cat: "Groceries",
                      amt: "-$142.30",
                    },
                    {
                      icon: RiWalletLine,
                      name: "Stripe Payout",
                      cat: "Income",
                      amt: "+$4,200.00",
                      pos: true,
                    },
                    {
                      icon: RiBankCardLine,
                      name: "Netflix",
                      cat: "Entertainment",
                      amt: "-$19.99",
                    },
                  ].map((t) => (
                    <TableRow key={t.name}>
                      <TableCell className="w-10">
                        <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                          <t.icon className="size-4" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{t.name}</span>
                          <span className="text-sm text-muted-foreground">
                            {t.cat}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={
                            t.pos
                              ? "text-sm font-semibold text-emerald-500 tabular-nums"
                              : "text-sm font-semibold tabular-nums"
                          }
                        >
                          {t.amt}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </DashCard>

          {/* FAQ — tabs + accordion */}
          <DashCard>
            <CardContent>
              <Tabs defaultValue="general">
                <TabsList className="w-full">
                  <TabsTrigger value="general" className="flex-1">
                    General
                  </TabsTrigger>
                  <TabsTrigger value="billing" className="flex-1">
                    Billing
                  </TabsTrigger>
                  <TabsTrigger value="goals" className="flex-1">
                    Goals
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="general">
                  <Accordion className="w-full">
                    <AccordionItem value="1">
                      <AccordionTrigger>
                        How secure is my data?
                      </AccordionTrigger>
                      <AccordionContent>
                        Bank-level AES-256 encryption, SOC 2 Type II
                        infrastructure, read-only access tokens.
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="2">
                      <AccordionTrigger>
                        How do I connect a bank?
                      </AccordionTrigger>
                      <AccordionContent>
                        Link accounts via our secure OAuth flow in settings.
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="3">
                      <AccordionTrigger>
                        Can I export for taxes?
                      </AccordionTrigger>
                      <AccordionContent>
                        Yes — export CSV or PDF from the reports page.
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </TabsContent>
                <TabsContent
                  value="billing"
                  className="text-sm text-muted-foreground"
                >
                  Manage your billing details here.
                </TabsContent>
                <TabsContent
                  value="goals"
                  className="text-sm text-muted-foreground"
                >
                  Track your savings goals here.
                </TabsContent>
              </Tabs>
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full">
                Contact Support
              </Button>
            </CardFooter>
          </DashCard>

          {/* Payments — breadcrumb + item list */}
          <DashCard>
            <CardHeader>
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink href="#">Home</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Payments</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </CardHeader>
            <CardContent>
              <ItemGroup>
                {[
                  {
                    icon: RiDashboardLine,
                    t: "Change transfer limit",
                    d: "Adjust how much you can send.",
                  },
                  {
                    icon: RiTimerLine,
                    t: "Scheduled transfers",
                    d: "Send at a later date.",
                  },
                  {
                    icon: RiRepeatLine,
                    t: "Direct Debits",
                    d: "Manage regular payments.",
                  },
                ].map((r) => (
                  <Item key={r.t} variant="muted" render={<a href="#" />}>
                    <ItemMedia variant="icon">
                      <r.icon />
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>{r.t}</ItemTitle>
                      <ItemDescription>{r.d}</ItemDescription>
                    </ItemContent>
                    <RiArrowRightSLine className="size-4 shrink-0 text-muted-foreground" />
                  </Item>
                ))}
              </ItemGroup>
            </CardContent>
          </DashCard>

          {/* Kitchen island — toggle group + sliders */}
          <DashCard>
            <CardHeader>
              <CardTitle>Kitchen Island</CardTitle>
              <CardDescription>Hue Color Ambient</CardDescription>
              <CardAction>
                <Switch defaultChecked />
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <ToggleGroup defaultValue={SCENE_DEFAULT} variant="outline">
                <ToggleGroupItem value="cooking">Cooking</ToggleGroupItem>
                <ToggleGroupItem value="dining">Dining</ToggleGroupItem>
                <ToggleGroupItem value="night">Nightlight</ToggleGroupItem>
              </ToggleGroup>
              <ItemGroup>
                {LIGHT_SCENES.map((s) => (
                  <Item key={s.t} variant="outline" size="sm">
                    <ItemMedia variant="icon">
                      <s.icon />
                    </ItemMedia>
                    <ItemContent className="flex-row items-center gap-3">
                      <ItemTitle className="shrink-0">{s.t}</ItemTitle>
                    </ItemContent>
                    <div className="flex flex-1 items-center">
                      <Slider defaultValue={s.v} max={100} className="w-full" />
                    </div>
                  </Item>
                ))}
              </ItemGroup>
            </CardContent>
          </DashCard>

          {/* Preferences — switches */}
          <DashCard>
            <CardHeader>
              <CardTitle>Preferences</CardTitle>
              <CardDescription>
                Account settings & notifications.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                {[
                  {
                    id: "public",
                    t: "Public Statistics",
                    d: "Show your stream count and activity.",
                  },
                  {
                    id: "emails",
                    t: "Email Notifications",
                    d: "Monthly royalty reports and updates.",
                  },
                ].map((f) => (
                  <Field key={f.id} orientation="horizontal">
                    <FieldContent>
                      <FieldLabel htmlFor={f.id}>{f.t}</FieldLabel>
                      <FieldDescription>{f.d}</FieldDescription>
                    </FieldContent>
                    <Switch id={f.id} defaultChecked />
                  </Field>
                ))}
              </FieldGroup>
            </CardContent>
            <CardFooter>
              <Button variant="outline">Reset</Button>
              <Button className="ml-auto">Save Preferences</Button>
            </CardFooter>
          </DashCard>

          {/* Payout preferences — radio group */}
          <DashCard>
            <CardHeader>
              <CardDescription>Payout Preferences</CardDescription>
              <CardTitle>Receiving Method</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="holder">Account Holder</FieldLabel>
                  <Input id="holder" defaultValue="Synthetic Horizons LLC" />
                </Field>
                <FieldSet>
                  <FieldLegend>Receiving Method</FieldLegend>
                  <RadioGroup
                    defaultValue="bank"
                    className="grid grid-cols-1 gap-3 md:grid-cols-2"
                  >
                    <FieldLabel htmlFor="m-bank">
                      <Field orientation="horizontal">
                        <RadioGroupItem value="bank" id="m-bank" />
                        <FieldContent>
                          <FieldTitle>Bank Transfer</FieldTitle>
                          <FieldDescription>SWIFT / IBAN</FieldDescription>
                        </FieldContent>
                      </Field>
                    </FieldLabel>
                    <FieldLabel htmlFor="m-paypal">
                      <Field orientation="horizontal">
                        <RadioGroupItem value="paypal" id="m-paypal" />
                        <FieldContent>
                          <FieldTitle>PayPal</FieldTitle>
                          <FieldDescription>Instant Payout</FieldDescription>
                        </FieldContent>
                      </Field>
                    </FieldLabel>
                  </RadioGroup>
                </FieldSet>
              </FieldGroup>
            </CardContent>
            <CardFooter>
              <Button className="w-full">Save Payout Settings</Button>
            </CardFooter>
          </DashCard>

          {/* Connect bank — empty */}
          <DashCard>
            <CardContent>
              <Empty>
                <EmptyMedia variant="icon">
                  <RiBankCardLine />
                </EmptyMedia>
                <EmptyHeader>
                  <EmptyTitle>Connect Bank</EmptyTitle>
                  <EmptyDescription>
                    Link your payout method to receive monthly distributions.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button>Set Up Payouts</Button>
                </EmptyContent>
              </Empty>
            </CardContent>
          </DashCard>

          {/* Syncing — empty + spinner */}
          <DashCard>
            <CardContent>
              <Empty>
                <EmptyMedia variant="icon">
                  <Spinner />
                </EmptyMedia>
                <EmptyHeader>
                  <EmptyTitle>Syncing your accounts</EmptyTitle>
                  <EmptyDescription>
                    Pulling your latest transactions. Takes a few seconds.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button variant="outline">Cancel</Button>
                </EmptyContent>
              </Empty>
            </CardContent>
          </DashCard>

          {/* Upcoming payments — calendar */}
          <DashCard>
            <CardHeader>
              <CardTitle>Upcoming Payments</CardTitle>
              <CardDescription>Select a date to view payments.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Item variant="outline" className="justify-center">
                <Calendar mode="single" className="w-full" />
              </Item>
              <ItemGroup>
                {[
                  { t: "Netflix Subscription", d: "Apr 15, 2024", a: "$19.99" },
                  { t: "Rent Payment", d: "Apr 1, 2024", a: "$2,400.00" },
                ].map((p) => (
                  <Item key={p.t} variant="muted">
                    <ItemContent>
                      <ItemTitle>{p.t}</ItemTitle>
                      <ItemDescription>{p.d}</ItemDescription>
                    </ItemContent>
                    <Badge variant="secondary">{p.a}</Badge>
                  </Item>
                ))}
              </ItemGroup>
            </CardContent>
          </DashCard>

          {/* Stock performance — area chart */}
          <DashCard>
            <CardHeader>
              <CardTitle>Stock Performance</CardTitle>
              <CardDescription>6-month price history.</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={areaConfig} className="h-[200px] w-full">
                <AreaChart data={areaData}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="m" tickLine={false} axisLine={false} />
                  <Area
                    dataKey="p"
                    type="natural"
                    fill="var(--color-p)"
                    fillOpacity={0.2}
                    stroke="var(--color-p)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </DashCard>

          {/* Transfer funds */}
          <DashCard>
            <CardHeader>
              <CardTitle>Transfer Funds</CardTitle>
              <CardDescription>Move money between accounts.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="tamt">Amount</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon align="inline-start">
                      <InputGroupText>$</InputGroupText>
                    </InputGroupAddon>
                    <InputGroupInput id="tamt" defaultValue="1,200.00" />
                  </InputGroup>
                </Field>
                <Field>
                  <FieldLabel htmlFor="from">From Account</FieldLabel>
                  <Select defaultValue="checking">
                    <SelectTrigger id="from" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="checking">
                        Main Checking — $12,450.00
                      </SelectItem>
                      <SelectItem value="savings">
                        High Yield Savings — $42,100.00
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </FieldGroup>
            </CardContent>
            <CardFooter>
              <Button className="w-full">Confirm Transfer</Button>
            </CardFooter>
          </DashCard>

          {/* Cover art — upload / aspect */}
          <DashCard>
            <CardContent className="flex flex-col gap-3">
              <Label className="text-center text-xs font-normal tracking-wider text-muted-foreground uppercase">
                Cover Art
              </Label>
              <Item variant="outline" className="aspect-square">
                <label
                  htmlFor="cover"
                  className="flex size-full cursor-pointer items-center justify-center"
                >
                  <RiImageLine className="size-10 text-muted-foreground/50" />
                </label>
              </Item>
              <input id="cover" type="file" className="sr-only" />
            </CardContent>
            <CardFooter className="flex-col gap-2">
              <Button variant="secondary" className="w-full">
                Upload Artwork
              </Button>
              <CardDescription className="text-center text-xs">
                Minimum 3000×3000px · JPEG or PNG
              </CardDescription>
            </CardFooter>
          </DashCard>

          {/* Loading — skeleton */}
          <DashCard>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Skeleton className="h-32 w-full rounded-lg" />
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-9 flex-1 rounded-md" />
                <Skeleton className="h-9 flex-1 rounded-md" />
              </div>
            </CardContent>
          </DashCard>

          {/* Account access — inputs + danger */}
          <DashCard>
            <CardHeader>
              <CardTitle>Account Access</CardTitle>
              <CardDescription>Update your credentials.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="email">Email Address</FieldLabel>
                  <Input
                    id="email"
                    type="email"
                    defaultValue="artist@studio.inc"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="pw">Current Password</FieldLabel>
                  <Input id="pw" type="password" defaultValue="password123" />
                </Field>
              </FieldGroup>
            </CardContent>
            <CardFooter className="flex-col gap-4">
              <Button className="w-full">
                <RiLockLine />
                Update Security
              </Button>
              <Item variant="muted" render={<a href="#" />}>
                <ItemMedia variant="icon">
                  <RiErrorWarningLine className="text-destructive" />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>Danger Zone</ItemTitle>
                  <ItemDescription>
                    Archive account and remove catalog
                  </ItemDescription>
                </ItemContent>
                <RiArrowRightLine className="size-4" />
              </Item>
            </CardFooter>
          </DashCard>

          {/* Notifications — checkboxes */}
          <DashCard>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>
                Choose what to be notified about.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                {[
                  {
                    id: "n-tx",
                    t: "Transaction alerts",
                    d: "Deposits, withdrawals, transfers.",
                    on: true,
                  },
                  {
                    id: "n-sec",
                    t: "Security alerts",
                    d: "Login attempts and account changes.",
                    on: true,
                  },
                  {
                    id: "n-goals",
                    t: "Goal milestones",
                    d: "Updates at 25/50/75/100%.",
                    on: false,
                  },
                  {
                    id: "n-mkt",
                    t: "Market updates",
                    d: "Daily portfolio summary.",
                    on: false,
                  },
                ].map((n) => (
                  <Field key={n.id} orientation="horizontal">
                    <Checkbox id={n.id} defaultChecked={n.on} />
                    <FieldContent>
                      <FieldLabel htmlFor={n.id}>{n.t}</FieldLabel>
                      <FieldDescription>{n.d}</FieldDescription>
                    </FieldContent>
                  </Field>
                ))}
              </FieldGroup>
            </CardContent>
            <CardFooter>
              <Button className="w-full">Save Preferences</Button>
            </CardFooter>
          </DashCard>

          {/* Search + toggle — input group + toast */}
          <DashCard>
            <CardHeader>
              <CardTitle>Holdings</CardTitle>
              <CardDescription>
                Search and filter your portfolio.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <InputGroup>
                <InputGroupAddon align="inline-start">
                  <RiSearchLine />
                </InputGroupAddon>
                <InputGroupInput placeholder="Search holdings or tickers…" />
              </InputGroup>
              <ToggleGroup defaultValue={FILTER_DEFAULT} variant="outline">
                <ToggleGroupItem value="stocks">Stocks</ToggleGroupItem>
                <ToggleGroupItem value="etfs">ETFs</ToggleGroupItem>
                <ToggleGroupItem value="reits">REITs</ToggleGroupItem>
              </ToggleGroup>
              <ItemGroup>
                {[
                  { s: "VOO", n: "Vanguard S&P 500", v: "$48,230.40" },
                  { s: "AAPL", n: "Apple Inc.", v: "$18,488.90" },
                ].map((h) => (
                  <Item key={h.s} variant="muted">
                    <ItemMedia>
                      <div className="flex size-12 items-center justify-center rounded-lg border text-sm font-semibold">
                        {h.s}
                      </div>
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>{h.n}</ItemTitle>
                      <ItemDescription className="text-xs tracking-wider uppercase">
                        112 Shares
                      </ItemDescription>
                    </ItemContent>
                    <span className="font-medium tabular-nums">{h.v}</span>
                  </Item>
                ))}
              </ItemGroup>
            </CardContent>
            <CardFooter>
              <Button
                variant="outline"
                className="w-full"
                onClick={() =>
                  toast("Portfolio synced", {
                    description: "Last updated just now.",
                  })
                }
              >
                Show toast
              </Button>
            </CardFooter>
          </DashCard>

          {/* Buttons + badges + avatar reference */}
          <DashCard>
            <CardHeader>
              <CardTitle>Controls</CardTitle>
              <CardDescription>Buttons, badges, icons.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                <Button>Default</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="destructive">Destructive</Button>
                <Button variant="link">Link</Button>
                <Button size="icon" aria-label="Add">
                  <RiAddLine />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge>Default</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="outline">Outline</Badge>
                <Badge variant="destructive">Destructive</Badge>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <RiUserLine className="size-5" />
                <RiBankLine className="size-5" />
                <RiLineChartLine className="size-5" />
                <RiBellLine className="size-5" />
                <RiWalletLine className="size-5" />
              </div>
            </CardContent>
          </DashCard>
        </div>
      </div>
    </main>
  )
}
