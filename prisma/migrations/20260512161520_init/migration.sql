-- CreateTable
CREATE TABLE "Employee" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "isManual" BOOLEAN NOT NULL DEFAULT true,
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

-- CreateTable
CREATE TABLE "SyncedTask" (
    "taskGid" TEXT NOT NULL,

    CONSTRAINT "SyncedTask_pkey" PRIMARY KEY ("taskGid")
);

-- CreateIndex
CREATE INDEX "Employee_periodStart_periodEnd_idx" ON "Employee"("periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "Employee_name_periodStart_periodEnd_idx" ON "Employee"("name", "periodStart", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "UserMapping_email_key" ON "UserMapping"("email");
