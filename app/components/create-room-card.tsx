import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardTitle,
    CardHeader,
    CardFooter
} from "@/components/ui/card"

import {
    Input,
} from "@/components/ui/input"

import {
    Label,
} from "@/components/ui/label"

import {
    Button,
} from "@/components/ui/button"

export default function CreateRoomCard() {
    return (
        <Card className="border-white/10 bg-slate-900/70 text-white shadow-xl backdrop-blur">
          <CardHeader>
            <CardTitle>Create Room</CardTitle>
                <CardDescription className="text-slate-300">
                    Leave the password blank to create a public room.
                </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="space-y-2">
                <Label htmlFor="room-password">Password</Label>
                <Input
                  id="room-password"
                  type="password"
                  placeholder="Optional password"
                  className="border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 mt-1"
                />
            </div>
          </CardContent>

          <CardFooter>
            <Button>Create Room</Button>
          </CardFooter>
        </Card>
    );
}