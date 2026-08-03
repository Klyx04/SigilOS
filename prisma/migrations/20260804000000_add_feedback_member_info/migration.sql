-- AlterTable: SystemIssue — pseudo Discord + guilde du membre qui a envoyé le feedback
ALTER TABLE "SystemIssue" ADD COLUMN "memberName" TEXT;
ALTER TABLE "SystemIssue" ADD COLUMN "memberGuildName" TEXT;