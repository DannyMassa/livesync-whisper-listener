export async function putIfRevision(dfm, path, content, metadata, revision) {
  const response = await dfm.liveSyncLocalDB.putDBEntryWithLiveBaseRevision({
    _id: await dfm.path2id(path),
    path,
    data: new Blob([content], { type: "text/plain" }),
    ctime: metadata.ctime,
    mtime: metadata.mtime,
    size: metadata.size,
    type: "plain",
    datatype: "plain",
    eden: {},
    children: [],
  }, revision);
  return response !== false;
}
