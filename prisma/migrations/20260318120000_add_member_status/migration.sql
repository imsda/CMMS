-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'WALK_IN');

-- AlterTable
ALTER TABLE "RosterMember" ADD COLUMN "memberStatus" "MemberStatus" NOT NULL DEFAULT 'ACTIVE';
