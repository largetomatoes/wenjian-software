package com.wenjian.reader;

import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONTokener;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.function.LongSupplier;
import javax.net.ssl.HttpsURLConnection;

/** Public release discovery only. APK signing and release signatures stay in WenjianUpdateClient. */
final class AppReleaseIndex {
    static final String OFFICIAL="https://largetomatoes.github.io/wenjian-web/updates/releases.json";
    static final String BACKUP="https://reader.wenjian-app.workers.dev/updates/releases.json";
    static final String GITHUB="https://api.github.com/repos/largetomatoes/wenjian-software/releases?per_page=30";
    interface Reader { String read(String url) throws Exception; }
    private final File cache;
    private final Reader reader;
    private final LongSupplier clock;
    private long githubRetryAt;
    private String githubFailure;
    AppReleaseIndex(File cache){this(cache,AppReleaseIndex::download,System::currentTimeMillis);}
    AppReleaseIndex(File cache,Reader reader,LongSupplier clock){this.cache=cache;this.reader=reader;this.clock=clock;}

    synchronized JSONArray releases(boolean manual)throws Exception {
        JSONObject old=null;
        try{if(cache.length()>4L*1024*1024)throw new IOException("更新缓存过大");old=new JSONObject(new String(Files.readAllBytes(cache.toPath()),StandardCharsets.UTF_8));if(old.has("releases"))validate(old.getJSONArray("releases"));}catch(Exception ignored){old=null;}
        long now=clock.getAsLong();
        if(!manual&&old!=null&&old.optLong("retryAt")>now)throw new IOException(old.optString("error","更新来源暂时无法连接。"));
        if(!manual&&old!=null&&!old.has("error")&&old.has("releases")&&now>=old.optLong("at")&&now-old.optLong("at")<86400000)return old.getJSONArray("releases");
        for(String url:new String[]{OFFICIAL,BACKUP,GITHUB}){
            if(url.equals(GITHUB)&&githubRetryAt>now)continue;
            try{
                JSONArray releases=parse(reader.read(url));
                save(new JSONObject().put("at",clock.getAsLong()).put("releases",releases));return releases;
            }catch(Exception error){
                if(url.equals(GITHUB)){githubFailure=error.getMessage();if(error instanceof RateLimited)githubRetryAt=((RateLimited)error).retryAt;}
            }
        }
        String message="官网与备用更新源暂时无法连接。"+(githubFailure==null?"请检查网络后重试。":githubFailure);
        JSONObject failed=new JSONObject().put("failedAt",now).put("error",message).put("retryAt",now+120000);
        if(old!=null&&old.has("releases")){failed.put("at",old.optLong("at")).put("releases",old.getJSONArray("releases"));}
        save(failed);throw new IOException(message);
    }
    private void save(JSONObject value){
        File temporary=new File(cache+".tmp");
        try{
            File parent=cache.getParentFile();if(!parent.isDirectory()&&!parent.mkdirs())return;
            try(FileOutputStream stream=new FileOutputStream(temporary)){stream.write(value.toString().getBytes(StandardCharsets.UTF_8));stream.getFD().sync();}
            Files.move(temporary.toPath(),cache.toPath(),StandardCopyOption.ATOMIC_MOVE,StandardCopyOption.REPLACE_EXISTING);
        }catch(Exception ignored){}finally{temporary.delete();}
    }
    static JSONArray parse(String text)throws Exception {
        Object value=new JSONTokener(text).nextValue();
        JSONArray releases=value instanceof JSONArray?(JSONArray)value:value instanceof JSONObject&&((JSONObject)value).optInt("schema")==1?((JSONObject)value).optJSONArray("releases"):null;
        validate(releases);JSONArray formal=new JSONArray();
        for(int i=0;i<releases.length();i++){JSONObject release=releases.getJSONObject(i);if(!release.optBoolean("draft")&&!release.optBoolean("prerelease"))formal.put(release);}
        return formal;
    }
    private static void validate(JSONArray releases)throws Exception {
        if(releases==null||releases.length()>60)throw new IOException("更新清单格式不正确。");
        for(int i=0;i<releases.length();i++){
            JSONObject r=releases.getJSONObject(i);if(r.getString("tag_name").isEmpty()||!trusted(r.getString("html_url")))throw new IOException("更新清单来源不正确。");
            JSONArray assets=r.getJSONArray("assets");for(int j=0;j<assets.length();j++)if(!trusted(assets.getJSONObject(j).getString("browser_download_url")))throw new IOException("安装包来源不正确。");
        }
    }
    private static boolean trusted(String value){
        try{URI u=new URI(value);String p=u.getRawPath();return "https".equals(u.getScheme())&&"github.com".equals(u.getHost())&&u.getPort()==-1&&u.getUserInfo()==null&&u.getQuery()==null&&u.getFragment()==null&&p!=null&&!p.toLowerCase(Locale.ROOT).matches(".*(%2f|%5c).*" )&&(root(p,"/largetomatoes/wenjian-software/releases")||root(p,"/largetomatoes/mac-/releases"));}catch(Exception ignored){return false;}
    }
    private static boolean root(String path,String base){return path.equals(base)||path.startsWith(base+"/tag/")||path.startsWith(base+"/download/");}
    static final class RateLimited extends IOException { final long retryAt;RateLimited(long at){super("GitHub 更新接口达到访问限额，可在 "+new SimpleDateFormat("HH:mm",Locale.CHINA).format(new Date(at))+" 后重试。");retryAt=at;} }
    private static String download(String url)throws Exception {
        HttpsURLConnection connection=(HttpsURLConnection)new URL(url).openConnection();
        connection.setConnectTimeout(2500);connection.setReadTimeout(3500);connection.setInstanceFollowRedirects(false);connection.setRequestProperty("User-Agent","Wenjian-Update-Check");connection.setRequestProperty("Accept","application/json");connection.setRequestProperty("Cache-Control","no-cache");
        try{
            int status=connection.getResponseCode();
            if(status!=200){
                if(status==429||status==403&&"0".equals(connection.getHeaderField("X-RateLimit-Remaining"))){long reset=System.currentTimeMillis()+120000;try{long value=Long.parseLong(connection.getHeaderField("X-RateLimit-Reset"))*1000;if(value>System.currentTimeMillis())reset=value;}catch(Exception ignored){}throw new RateLimited(reset);}
                throw new IOException("更新来源返回 "+status+"，请稍后重试。");
            }
            try(InputStream input=connection.getInputStream();ByteArrayOutputStream output=new ByteArrayOutputStream()){
                byte[] buffer=new byte[16384];int n;while((n=input.read(buffer))!=-1){if(output.size()+n>4*1024*1024)throw new IOException("更新清单过大。");output.write(buffer,0,n);}return output.toString("UTF-8");
            }
        }catch(SocketTimeoutException error){throw new IOException("连接更新来源超时，请检查网络后重试。");}finally{connection.disconnect();}
    }
}
