"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { User, Users, MessageSquare, LogOut } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UserMenuProps {
  username?: string;
}

export default function UserMenu({ username }: UserMenuProps) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("Failed to log out", error);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white border-0">
          <Avatar className="h-7 w-7">
            <AvatarImage src="/icons/Login.svg" alt="User avatar" />
            <AvatarFallback>{username ? username.charAt(0).toUpperCase() : "U"}</AvatarFallback>
          </Avatar>
          <span className="hidden text-sm font-medium sm:inline capitalize">
            {username || "Player"}
          </span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-48 bg-[#0b182d] text-slate-200 border-slate-700">
        <DropdownMenuItem asChild className="hover:bg-slate-800 focus:bg-slate-800 cursor-pointer">
          <Link href="/profile" className="flex items-center gap-2 w-full">
            <User className="h-4 w-4" />
            <span>View Profile</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild className="hover:bg-slate-800 focus:bg-slate-800 cursor-pointer">
          <Link href="/friends" className="flex items-center gap-2 w-full">
            <Users className="h-4 w-4" />
            <span>Friends</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild className="hover:bg-slate-800 focus:bg-slate-800 cursor-pointer">
          <Link href="/messages" className="flex items-center gap-2 w-full">
            <MessageSquare className="h-4 w-4" />
            <span>Messages</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={handleLogout} className="text-red-400 hover:bg-slate-800 hover:text-red-300 focus:bg-slate-800 focus:text-red-300 cursor-pointer flex items-center gap-2">
          <LogOut className="h-4 w-4" />
          <span>Logout</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}