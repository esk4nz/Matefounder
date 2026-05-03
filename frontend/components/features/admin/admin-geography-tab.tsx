"use client"

import { MapPin } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function AdminGeographyTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Управління локаціями</CardTitle>
        <CardDescription>
          Довідник регіонів і міст для фільтрів оголошень та профілів.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-xl border border-border ring-1 ring-foreground/10">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-foreground">
                  Регіон
                </th>
                <th className="px-4 py-3 text-left font-medium text-foreground">
                  Населений пункт
                </th>
                <th className="px-4 py-3 text-left font-medium text-foreground">
                  Тип
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td
                  colSpan={3}
                  className="bg-muted/20 px-4 py-14 text-center align-middle"
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex size-11 items-center justify-center rounded-full bg-muted">
                      <MapPin className="size-5 text-muted-foreground" aria-hidden />
                    </div>
                    <p className="text-sm text-muted-foreground">Немає записів</p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
