"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { errorMessage } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/components/Providers";

// Local-timezone yyyy-mm-dd; toISOString() would shift the day across UTC.
function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function SettingsPage() {
  const session = useSession();
  const qc = useQueryClient();

  const profile = useQuery({
    queryKey: ["user_profile"],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_profile")
        .select("*")
        .eq("user_id", session!.user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState({
    height_cm: "",
    birth_date: "",
    biological_sex: "male",
    goal: "maintain",
    activity_multiplier: "1.375",
  });
  const [dateOpen, setDateOpen] = useState(false);

  useEffect(() => {
    if (profile.data) {
      setForm({
        height_cm: profile.data.height_cm?.toString() ?? "",
        birth_date: profile.data.birth_date ?? "",
        biological_sex: profile.data.biological_sex ?? "male",
        goal: profile.data.goal ?? "maintain",
        activity_multiplier: profile.data.activity_multiplier?.toString() ?? "1.375",
      });
    }
  }, [profile.data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("user_profile").upsert({
        user_id: session!.user.id,
        height_cm: form.height_cm ? Number(form.height_cm) : null,
        birth_date: form.birth_date || null,
        biological_sex: form.biological_sex,
        goal: form.goal,
        activity_multiplier: Number(form.activity_multiplier),
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user_profile"] });
      qc.invalidateQueries({ queryKey: ["weekly_balance"] });
    },
  });

  return (
    <div className="space-y-5">
      <div className="pt-1">
        <h1 className="text-xl font-extrabold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          These calibrate your calorie target and energy balance.
        </p>
      </div>

      <Card className="space-y-4 p-5">
        <div className="space-y-1.5">
          <Label htmlFor="height">Height (cm)</Label>
          <Input
            id="height"
            className="h-11 rounded-xl"
            type="number"
            value={form.height_cm}
            onChange={(e) => setForm({ ...form, height_cm: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Birth date</Label>
          <Popover open={dateOpen} onOpenChange={setDateOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="h-11 w-full justify-between rounded-xl font-normal"
              >
                {form.birth_date
                  ? new Date(form.birth_date).toLocaleDateString([], {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })
                  : "Select date"}
                <ChevronDown className="size-4 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                captionLayout="dropdown"
                selected={form.birth_date ? new Date(form.birth_date) : undefined}
                defaultMonth={form.birth_date ? new Date(form.birth_date) : new Date(1995, 0)}
                onSelect={(d) => {
                  setForm({ ...form, birth_date: d ? toISODate(d) : "" });
                  setDateOpen(false);
                }}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-1.5">
          <Label>Biological sex (for the BMR formula)</Label>
          <Select
            value={form.biological_sex}
            onValueChange={(v) => setForm({ ...form, biological_sex: v })}
          >
            <SelectTrigger className="h-11 w-full rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Goal</Label>
          <Select value={form.goal} onValueChange={(v) => setForm({ ...form, goal: v })}>
            <SelectTrigger className="h-11 w-full rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cut">Lose weight</SelectItem>
              <SelectItem value="maintain">Maintain</SelectItem>
              <SelectItem value="bulk">Gain weight</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Activity level (fallback without wearable data)</Label>
          <Select
            value={form.activity_multiplier}
            onValueChange={(v) => setForm({ ...form, activity_multiplier: v })}
          >
            <SelectTrigger className="h-11 w-full rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1.2">Sedentary</SelectItem>
              <SelectItem value="1.375">Lightly active</SelectItem>
              <SelectItem value="1.55">Moderately active</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Button className="h-12 w-full rounded-full" disabled={save.isPending} onClick={() => save.mutate()}>
        {save.isPending ? "Saving…" : "Save profile"}
      </Button>
      {save.isSuccess && <p className="text-center text-sm font-medium">Saved ✓</p>}
      {save.isError && <p className="text-sm text-destructive">{errorMessage(save.error)}</p>}

      <button
        className="w-full text-center text-sm text-muted-foreground underline"
        onClick={() => supabase.auth.signOut()}
      >
        Sign out
      </button>
    </div>
  );
}
