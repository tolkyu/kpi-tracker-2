-- CreateTable
CREATE TABLE "Employee" (
    "id" SERIAL NOT NULL,
    "periodKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "done" INTEGER NOT NULL DEFAULT 0,
    "own" INTEGER NOT NULL DEFAULT 0,
    "l1" INTEGER NOT NULL DEFAULT 0,
    "l2" INTEGER NOT NULL DEFAULT 0,
    "l3" INTEGER NOT NULL DEFAULT 0,
    "help" INTEGER NOT NULL DEFAULT 0,
    "hdone" INTEGER NOT NULL DEFAULT 0,
    "blk" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserMapping" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "UserMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Employee_periodKey_idx" ON "Employee"("periodKey");

-- CreateIndex
CREATE UNIQUE INDEX "UserMapping_email_key" ON "UserMapping"("email");
