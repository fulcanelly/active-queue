import { duration } from "moment";
import { queue } from "./queue";

async function test() {
  for (let i = 0; i < 100; i++) {
    await queue.in(duration(20, 'seconds')).hmmm()
  }

  for (let i = 0; i < 100; i++) {
    await queue.later().hmmm()
  }

  await queue.later().shouldFail()
}

void test()
