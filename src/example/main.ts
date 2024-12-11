import { duration } from "moment";
import { queue } from "./queue";

async function test() {
  for (let i = 0; i < 100; i++) {
    await queue.in(duration(20, 'seconds')).hmmm()
  }
  for (let i = 0; i < 100; i++) {
    await queue.latter().hmmm()
  }

}

void test()
