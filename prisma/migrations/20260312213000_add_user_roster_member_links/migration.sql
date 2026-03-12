-- CreateTable
CREATE TABLE "UserRosterMemberLink" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rosterMemberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRosterMemberLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserRosterMemberLink_userId_rosterMemberId_key" ON "UserRosterMemberLink"("userId", "rosterMemberId");

-- CreateIndex
CREATE INDEX "UserRosterMemberLink_rosterMemberId_idx" ON "UserRosterMemberLink"("rosterMemberId");

-- AddForeignKey
ALTER TABLE "UserRosterMemberLink" ADD CONSTRAINT "UserRosterMemberLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRosterMemberLink" ADD CONSTRAINT "UserRosterMemberLink_rosterMemberId_fkey" FOREIGN KEY ("rosterMemberId") REFERENCES "RosterMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
