import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  initialEmail: string;
};

export function ProfileEmailCard({
  initialEmail,
}: Props) {
  return (
    <Card className="border-none bg-white shadow-[0_18px_50px_-20px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/80">
      <CardHeader className="space-y-2">
        <CardTitle className="text-xl font-bold text-slate-900">Email</CardTitle>
        <CardDescription>
          Email акаунта відображається як інформаційне поле і не редагується в профілі.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid gap-1">
          <Label htmlFor="currentEmail" className="text-slate-700">
            Email
          </Label>
          <Input id="currentEmail" value={initialEmail} readOnly />
        </div>
      </CardContent>
    </Card>
  );
}
