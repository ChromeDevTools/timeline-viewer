var gulp = require('gulp'),
    webserver = require('gulp-webserver'),
    rename = require('gulp-rename'),
    ghPages = require('gulp-gh-pages');

gulp.task('config:dev', function () {
    gulp.src('config_dev.js')
        .pipe(rename('config.js'))
        .pipe(gulp.dest('docs/'))
});

gulp.task('config:prod', function () {
    gulp.src('config_prod.js')
        .pipe(rename('config.js'))
        .pipe(gulp.dest('docs/'))
});

gulp.task('dev', ['config:dev'], function () {
    gulp.src('docs')
        .pipe(webserver({

        }))
})

gulp.task('deploy', ['config:prod'], function () {
    return gulp.src('./docs/**/*')
        .pipe(ghPages());
})
