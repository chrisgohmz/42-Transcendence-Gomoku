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
        <Card>
          <CardHeader>
            <CardTitle>Create Room</CardTitle>
            <CardDescription>
              Leave the password blank to create a public room.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div>
              <Label htmlFor="room-password">Password</Label>
              <Input id="room-password" type="password" placeholder="Optional password" />
            </div>
          </CardContent>

          <CardFooter>
            <Button>Create Room</Button>
          </CardFooter>
        </Card>
    );
}