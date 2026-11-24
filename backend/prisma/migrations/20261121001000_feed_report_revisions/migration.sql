DROP INDEX "feed_reports_postId_userId_key";
CREATE UNIQUE INDEX "feed_reports_postId_userId_revisionNumber_key" ON feed_reports("postId","userId","revisionNumber");
