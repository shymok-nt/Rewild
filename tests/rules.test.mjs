import test from "node:test";
import assert from "node:assert/strict";
import {clampLane,runnerSpeed,jumpArc,avoidsObstacle,crossesPlayer} from "../src/rules.ts";

test("lanes stay in three-lane range",()=>{
  assert.equal(clampLane(-3),-1);
  assert.equal(clampLane(2),1);
  assert.equal(clampLane(0),0);
});
test("speed increases and caps at 24",()=>{
  assert.equal(runnerSpeed(0),13);
  assert.equal(runnerSpeed(450),14);
  assert.equal(runnerSpeed(10000),24);
});
test("jump arc starts and ends grounded",()=>{
  assert.equal(jumpArc(0),0);
  assert.ok(jumpArc(0.41)>1.7);
  assert.equal(jumpArc(0.82),0);
});
test("obstacles have distinct avoidance rules",()=>{
  assert.equal(avoidsObstacle("barrier",1,false),true);
  assert.equal(avoidsObstacle("barrier",0,false),false);
  assert.equal(avoidsObstacle("gate",0,true),true);
  assert.equal(avoidsObstacle("gate",1,false),false);
  assert.equal(avoidsObstacle("vehicle",2,true),false);
});
test("swept collision handles large steps",()=>{
  assert.equal(crossesPlayer(-2,2),true);
  assert.equal(crossesPlayer(-4,-3),false);
  assert.equal(crossesPlayer(3,4),false);
});
