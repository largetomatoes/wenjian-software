package com.wenjian.reader;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.atomic.*;
import org.json.*;
public final class AppReleaseIndexTest {
 static final String ROOT="https://github.com/largetomatoes/wenjian-software/releases";
 static final String LIST="[{\"tag_name\":\"v3.141-build338\",\"html_url\":\""+ROOT+"/tag/v3.141-build338\",\"body\":\"阅读与思考\",\"assets\":[]}]";
 static void check(boolean value,String message){if(!value)throw new AssertionError(message);}
 static void fails(Throwing task)throws Exception{try{task.run();throw new AssertionError("Expected failure");}catch(IOException expected){}}
 interface Throwing{void run()throws Exception;}
 public static void main(String[] args)throws Exception{
  Path temp=Files.createTempDirectory("wenjian-release-test-");int passed=0;
  try{
   List<String> urls=new ArrayList<>();AppReleaseIndex a=new AppReleaseIndex(temp.resolve("official.json").toFile(),url->{urls.add(url);return "{\"schema\":1,\"releases\":"+LIST+"}";},()->1000000);
   check(a.releases(true).length()==1,"official metadata");check(urls.equals(List.of(AppReleaseIndex.OFFICIAL)),"working official source must never use API quota");passed++;
   urls.clear();AppReleaseIndex b=new AppReleaseIndex(temp.resolve("backup.json").toFile(),url->{urls.add(url);return url.equals(AppReleaseIndex.OFFICIAL)?"<html>error</html>":LIST;},()->1000000);
   check(b.releases(true).length()==1,"backup metadata");check(urls.equals(List.of(AppReleaseIndex.OFFICIAL,AppReleaseIndex.BACKUP)),"malformed primary falls back");passed++;
   AtomicLong now=new AtomicLong(1000000);AtomicBoolean healthy=new AtomicBoolean(true);AtomicInteger calls=new AtomicInteger();File file=temp.resolve("history.json").toFile();
   AppReleaseIndex c=new AppReleaseIndex(file,url->{calls.incrementAndGet();if(!healthy.get())throw new IOException("offline");return LIST;},now::get);
   c.releases(true);healthy.set(false);now.addAndGet(1000);fails(()->c.releases(true));JSONObject saved=new JSONObject(Files.readString(file.toPath()));check(saved.getJSONArray("releases").length()==1,"failed refresh must retain last success");check(saved.getLong("at")==1000000,"success timestamp preserved");int count=calls.get();fails(()->c.releases(false));check(calls.get()==count,"two-minute automatic backoff");healthy.set(true);c.releases(true);check(!new JSONObject(Files.readString(file.toPath())).has("error"),"manual recovery clears failure");passed++;
   AtomicInteger apiCalls=new AtomicInteger();AtomicBoolean mirrorHealthy=new AtomicBoolean(false);AppReleaseIndex d=new AppReleaseIndex(temp.resolve("rate.json").toFile(),url->{if(!url.equals(AppReleaseIndex.GITHUB)){if(mirrorHealthy.get())return LIST;throw new IOException("offline");}apiCalls.incrementAndGet();throw new AppReleaseIndex.RateLimited(99999999);},now::get);
   fails(()->d.releases(true));fails(()->d.releases(true));check(apiCalls.get()==1,"rate-limited API cooldown");mirrorHealthy.set(true);check(d.releases(true).length()==1,"API cooldown cannot disable mirrors");passed++;
   File old=temp.resolve("legacy.json").toFile();Files.writeString(old.toPath(),"{\"at\":1000000,\"error\":\"old one-hour error\"}");AppReleaseIndex e=new AppReleaseIndex(old,url->LIST,now::get);check(e.releases(false).length()==1,"legacy negative cache must not block sources");passed++;
   try{AppReleaseIndex.parse(LIST.replace(ROOT,"https://evil.invalid/releases"));throw new AssertionError("unsafe metadata accepted");}catch(IOException expected){}passed++;
   AppReleaseIndex f=new AppReleaseIndex(temp.resolve("success.json").toFile(),url->{calls.incrementAndGet();return LIST;},now::get);f.releases(true);count=calls.get();f.releases(false);check(calls.get()==count,"successful cache reuse");check(Files.readString(temp.resolve("success.json")).contains("阅读与思考"),"cache encoding is UTF-8");passed++;
   System.out.println("PASS: "+passed+" Android release-source checks (fallback, quota, cache history, manual retry, source validation, UTF-8)");
  }finally{try(var files=Files.walk(temp)){files.sorted(Comparator.reverseOrder()).forEach(p->{try{Files.delete(p);}catch(Exception ignored){}});}}
 }
}
