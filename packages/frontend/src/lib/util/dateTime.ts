function convertISO8601ToUnixTime(dateString: string): number {
  const parsedDate = Date.parse(dateString);
  const timestampInSeconds = parsedDate / 1000;
  return timestampInSeconds;
}

export {convertISO8601ToUnixTime};
