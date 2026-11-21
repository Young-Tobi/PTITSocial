# Fixed JVM flags for the local 1 GB worker. Compiler flags from the browser are ignored.
# Limit Java's reserved address space, heap and JVM threads inside isolate.
java = '/usr/local/openjdk13/bin/'
flags = '-Xms16m -Xmx128m -Xss512k -XX:+UseSerialGC -XX:ActiveProcessorCount=1 ' \
        '-XX:MaxMetaspaceSize=96m -XX:CompressedClassSpaceSize=32m -XX:ReservedCodeCacheSize=32m'
compiler_flags = flags.split.map { |flag| "-J#{flag}" }.join(' ')
Language.find(62).update!(
  compile_cmd: "#{java}javac #{compiler_flags} %s Main.java",
  run_cmd: "#{java}java #{flags} Main"
)
