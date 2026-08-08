"use client";

import { useState } from "react";
import { Plus, History, Loader2 } from "lucide-react";
import { useApiQuery, apiFetch } from "@/hooks/use-api";
import type { ApiInvestmentEvent, InvestmentEventType } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const EVENT_TYPE_LABELS: Record<InvestmentEventType, string> = {
  return: "Return",
  dividend: "Dividend",
  sale: "Full Sale",
  partial_sale: "Partial Sale",
  loss: "Loss",
  fee: "Fee",
};

interface EventHistorySectionProps {
  investmentId: string;
  onChanged: () => void;
}

function getEventColor(eventType: InvestmentEventType) {
  switch (eventType) {
    case "return":
    case "dividend":
      return "text-income";
    case "sale":
    case "partial_sale":
      return "text-income";
    case "loss":
    case "fee":
      return "text-expense";
    default:
      return "text-muted-foreground";
  }
}

function getEventBg(eventType: InvestmentEventType) {
  switch (eventType) {
    case "return":
    case "dividend":
      return "bg-income-surface";
    case "sale":
    case "partial_sale":
      return "bg-income-surface";
    case "loss":
    case "fee":
      return "bg-expense-surface";
    default:
      return "bg-muted/50";
  }
}

export function EventHistorySection({ investmentId, onChanged }: EventHistorySectionProps) {
  const { toast } = useToast();
  const {
    data,
    loading,
    error,
    refresh,
  } = useApiQuery<{ events: ApiInvestmentEvent[] }>(
    `/api/investments/${investmentId}/events`,
  );

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    eventType: "return" as InvestmentEventType,
    amount: "",
    eventDate: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number.parseFloat(formData.amount);
    if (Number.isNaN(amount) || amount <= 0) {
      toast({ title: "Error", description: "Enter a valid amount", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      await apiFetch(`/api/investments/${investmentId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: formData.eventType,
          amount,
          eventDate: formData.eventDate,
          notes: formData.notes || null,
        }),
      });

      toast({ title: "Success", description: "Event logged" });
      setIsAddOpen(false);
      setFormData({
        eventType: "return",
        amount: "",
        eventDate: new Date().toISOString().split("T")[0],
        notes: "",
      });
      refresh();
      onChanged();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to log event";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const events = data?.events ?? [];

  return (
    <div className="space-y-3 border-t border-border/50 pt-3 mt-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-1.5">
          <History className="size-3.5" />
          Event History
        </h4>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="h-7 text-xs">
              <Plus className="size-3 mr-1" />
              Log Event
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Log Investment Event</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="event-type">Event Type</Label>
                <Select
                  value={formData.eventType}
                  onValueChange={(val) =>
                    setFormData((prev) => ({
                      ...prev,
                      eventType: val as InvestmentEventType,
                    }))
                  }
                >
                  <SelectTrigger id="event-type" aria-label="Event type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(EVENT_TYPE_LABELS) as [InvestmentEventType, string][]).map(
                      ([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-amount">Amount</Label>
                <Input
                  id="event-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, amount: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-date">Date</Label>
                <Input
                  id="event-date"
                  type="date"
                  value={formData.eventDate}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, eventDate: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-notes">Notes (optional)</Label>
                <Input
                  id="event-notes"
                  placeholder="e.g. Quarterly dividend"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, notes: e.target.value }))
                  }
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" className="flex-1" disabled={saving}>
                  {saving ? "Saving..." : "Log Event"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddOpen(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-3">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="text-center py-3">
          <p className="text-xs text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" className="mt-2 h-7 text-xs" onClick={refresh}>
            Retry
          </Button>
        </div>
      ) : events.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">
          No events recorded yet
        </p>
      ) : (
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {events.slice(0, 6).map((event) => (
            <div
              key={event.id}
              className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${getEventBg(event.event_type)}`}
            >
              <div>
                <p className={`font-medium text-xs ${getEventColor(event.event_type)}`}>
                  {EVENT_TYPE_LABELS[event.event_type]}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(event.event_date).toLocaleDateString("en-GB")}
                  {event.notes && (
                    <span className="ml-2">· {event.notes}</span>
                  )}
                </p>
              </div>
              <span className={`text-sm font-semibold tabular-nums ${getEventColor(event.event_type)}`}>
                {formatCurrency(event.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
